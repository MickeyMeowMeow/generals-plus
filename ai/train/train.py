"""
PPO training with CNN + LSTM for Generals Plus.

Uses the built-in ai/sim JAX environment (matching TS engine rules)
for vectorized self-play.

The recurrent network processes single-frame (spatial, scalar) observations
through a CNN + LSTM architecture, with LSTM state carried across steps.

Usage (from the ai/ directory):
    python -m train.train --grid-size 10 --num-envs 64
"""

import argparse
import time

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx
import optax

# JAX-native game simulator matching generals-plus TypeScript engine rules
from ..sim.action import compute_valid_move_mask
from ..sim.env import GeneralsEnv
from ..sim import game
from ..sim.types import Observation
from ..sim.rewards import potential_based_reward
from ..sim.memory import init_memory, update_memory, memory_to_channels, MemoryState

from .network import UNetPolicyValueNetwork


def obs_to_spatial(obs: Observation) -> jnp.ndarray:
    """Convert generals-bots Observation to (9, H, W) spatial tensor."""
    return jnp.stack([
        obs.armies,
        obs.generals,
        obs.cities,
        obs.mountains,
        obs.neutral_cells,
        obs.owned_cells,
        obs.opponent_cells,
        obs.fog_cells,
        obs.structures_in_fog,
    ], axis=0).astype(jnp.float32)


def obs_to_scalars(obs: Observation) -> jnp.ndarray:
    """Extract scalar features from Observation (6-dim)."""
    return jnp.array([
        obs.owned_land_count,
        obs.owned_army_count,
        obs.opponent_land_count,
        obs.opponent_army_count,
        obs.timestep,
        1.0,  # placeholder for num_alive (not directly available)
    ], dtype=jnp.float32)


def random_action(key, obs):
    """Random valid action for opponent."""
    mask = compute_valid_move_mask(obs.armies, obs.owned_cells, obs.mountains)
    valid = jnp.argwhere(mask, size=100, fill_value=-1)
    num_valid = jnp.sum(jnp.all(valid >= 0, axis=-1))

    k1, k2 = jrandom.split(key)
    should_pass = num_valid == 0
    idx = jnp.minimum(jrandom.randint(k1, (), 0, jnp.maximum(num_valid, 1)), num_valid - 1)
    move = valid[idx]
    is_half = jrandom.randint(k2, (), 0, 2)

    return jnp.array([should_pass, move[0], move[1], move[2], is_half], dtype=jnp.int32)


# ---------------------------------------------------------------------------
# Rollout
# ---------------------------------------------------------------------------

def make_rollout_step(network):
    """Create a jitted rollout step that processes single frames with LSTM state."""

    @jax.jit
    def rollout_step(carry, _):
        states, lstm_states, key = carry
        num_envs = states.armies.shape[0]
        hidden_dim = network.lstm_cell.hidden_size

        # Get observations for player 0
        obs_p0 = jax.vmap(lambda s: game.get_observation(s, 0))(states)
        obs_p1 = jax.vmap(lambda s: game.get_observation(s, 1))(states)

        # Build spatial and scalar inputs (single-frame)
        spatial = jax.vmap(obs_to_spatial)(obs_p0)       # (num_envs, 9, H, W)
        scalars = jax.vmap(obs_to_scalars)(obs_p0)        # (num_envs, 6)
        masks = jax.vmap(lambda o: compute_valid_move_mask(o.armies, o.owned_cells, o.mountains))(obs_p0)

        # Network forward pass for all envs — single frame + LSTM state
        key, *env_keys = jrandom.split(key, num_envs + 1)
        actions_p0, values, logprobs, entropies, new_lstm_states = jax.vmap(
            lambda s, sc, ls, m, k: network(s, sc, ls, m, k, None)
        )(spatial, scalars, lstm_states, masks, jnp.stack(env_keys))

        # Random opponent
        key, *opp_keys = jrandom.split(key, num_envs + 1)
        actions_p1 = jax.vmap(random_action)(jnp.stack(opp_keys), obs_p1)

        # Step game
        actions = jnp.stack([actions_p0, actions_p1], axis=1)
        new_states, infos = jax.vmap(game.step)(states, actions)

        # Reward
        obs_p0_new = jax.vmap(lambda s: game.get_observation(s, 0))(new_states)
        rewards = jax.vmap(composite_reward_fn)(obs_p0, actions_p0, obs_p0_new)

        # Done
        terminated = infos.is_done
        truncated = (new_states.time >= 500) & ~terminated
        dones = terminated | truncated

        # Reset LSTM state for done envs
        zero_lstm = (
            jnp.zeros((num_envs, hidden_dim)),
            jnp.zeros((num_envs, hidden_dim)),
        )
        lstm_states_for_next = jax.tree.map(
            lambda reset, current: jnp.where(
                dones.reshape(num_envs, 1), reset, current,
            ),
            zero_lstm, new_lstm_states,
        )

        # Save the *input* LSTM states for training (before reset)
        carry = (new_states, lstm_states_for_next, key)
        return carry, (spatial, scalars, masks, actions_p0, logprobs, values, rewards, dones, infos, lstm_states)

    return rollout_step


# ---------------------------------------------------------------------------
# PPO loss
# ---------------------------------------------------------------------------

@eqx.filter_jit
def ppo_loss(network, spatial, scalar, lstm_h, lstm_c, mask, action, old_logprob, advantage, ret, clip=0.2):
    """PPO loss for a single sample (with its recorded LSTM state)."""
    lstm_state = (lstm_h, lstm_c)
    _, value, logprob, entropy, _ = network(
        spatial, scalar, lstm_state, mask, jrandom.PRNGKey(0), action,
    )

    ratio = jnp.exp(logprob - old_logprob)
    clipped = jnp.clip(ratio, 1 - clip, 1 + clip) * advantage
    policy_loss = -jnp.minimum(ratio * advantage, clipped)

    value_loss = 0.5 * (value - ret) ** 2
    entropy_loss = -0.01 * entropy

    return policy_loss + value_loss + entropy_loss


def train_step(network, opt_state, batch, optimizer):
    """Single training step on a minibatch."""
    (spatial, scalar, lstm_h, lstm_c, masks,
     actions, old_logprobs, advantages, returns) = batch
    bs = spatial.shape[0]

    def loss_fn(net):
        losses = jax.vmap(
            lambda s, sc, lh, lc, m, a, olp, adv, r: ppo_loss(
                net, s, sc, lh, lc, m, a, olp, adv, r,
            )
        )(spatial, scalar, lstm_h, lstm_c, masks, actions, old_logprobs, advantages, returns)
        return jnp.mean(losses)

    loss, grads = eqx.filter_value_and_grad(loss_fn)(network)
    updates, opt_state = optimizer.update(grads, opt_state, network)
    network = eqx.apply_updates(network, updates)

    return network, opt_state, loss


# ---------------------------------------------------------------------------
# GAE
# ---------------------------------------------------------------------------

@jax.jit
def compute_gae(rewards, values, dones, gamma=0.99, lam=0.95):
    """Compute advantages using GAE."""
    num_steps, num_envs = rewards.shape
    advantages = jnp.zeros_like(rewards)
    last_adv = jnp.zeros(num_envs)

    for t in reversed(range(num_steps)):
        next_value = jnp.where(t == num_steps - 1, 0.0, values[t + 1])
        next_nonterminal = jnp.where(t == num_steps - 1, 1.0 - dones[t], 1.0 - dones[t + 1])
        delta = rewards[t] + gamma * next_value * next_nonterminal - values[t]
        advantages = advantages.at[t].set(delta + gamma * lam * next_nonterminal * last_adv)
        last_adv = advantages[t]

    return advantages


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generals Plus PPO Training")
    parser.add_argument("--grid-size", type=int, default=10, help="Grid size (square)")
    parser.add_argument("--num-envs", type=int, default=64, help="Number of parallel environments")
    parser.add_argument("--num-steps", type=int, default=128, help="Steps per rollout")
    parser.add_argument("--num-iterations", type=int, default=500, help="Training iterations")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--minibatch-size", type=int, default=64, help="Minibatch size")
    parser.add_argument("--save-path", default="models/ppo_recurrent.eqx", help="Model save path")
    args = parser.parse_args()

    grid_size = args.grid_size
    num_envs = args.num_envs
    num_steps = args.num_steps

    print(f"Generals Plus — PPO with CNN+LSTM (single-frame)")
    print(f"Grid:          {grid_size}x{grid_size}")
    print(f"Environments:  {num_envs}")
    print(f"Device:        {jax.devices()[0]}")
    print()

    # Initialize network
    key = jrandom.PRNGKey(42)
    key, net_key = jrandom.split(key)
    network = RecurrentPolicyValueNetwork(
        net_key,
        grid_size=grid_size,
        hidden_dim=128,
        scalar_dim=6,
    )
    optimizer = optax.adam(args.lr)
    opt_state = optimizer.init(eqx.filter(network, eqx.is_array))

    params, _ = eqx.partition(network, eqx.is_array)
    num_params = sum(x.size for x in jax.tree.leaves(params))
    print(f"Parameters: {num_params:,}")
    print()

    # Initialize environment
    env = GeneralsEnv(grid_dims=(grid_size, grid_size), truncation=500)
    key, pool_key, init_key = jrandom.split(key, 3)
    pool, _ = env.reset(pool_key)
    key, *state_keys = jrandom.split(key, num_envs + 1)
    states = jax.vmap(env.init_state)(jnp.stack(state_keys))

    # Initialize LSTM states (zero-initialized per env)
    hidden_dim = network.lstm_cell.hidden_size
    lstm_states = (
        jnp.zeros((num_envs, hidden_dim)),
        jnp.zeros((num_envs, hidden_dim)),
    )

    # Build rollout step
    rollout_step = make_rollout_step(network)

    # Warmup
    print("Warming up...")
    carry = (states, lstm_states, key)
    for _ in range(3):
        carry, _ = rollout_step(carry, None)
    jax.block_until_ready(carry[0])
    print("Training...\n")

    for iteration in range(args.num_iterations):
        t0 = time.time()

        # Collect rollout
        carry = (states, lstm_states, key)
        rollout_data = []
        for _ in range(num_steps):
            carry, data = rollout_step(carry, None)
            rollout_data.append(data)

        states, lstm_states, key = carry
        jax.block_until_ready(states)

        # Stack rollout data
        # data = (spatial, scalars, masks, actions_p0, logprobs, values, rewards, dones, infos, lstm_states_in)
        spatial_all = jnp.stack([d[0] for d in rollout_data])
        scalar_all = jnp.stack([d[1] for d in rollout_data])
        masks_all = jnp.stack([d[2] for d in rollout_data])
        actions_all = jnp.stack([d[3] for d in rollout_data])
        logprobs_all = jnp.stack([d[4] for d in rollout_data])
        values_all = jnp.stack([d[5] for d in rollout_data])
        rewards_all = jnp.stack([d[6] for d in rollout_data])
        dones_all = jnp.stack([d[7] for d in rollout_data])
        infos_all = [d[8] for d in rollout_data]
        # LSTM states: d[9] is (h, c) tuple, each (num_envs, hidden_dim)
        lstm_h_all = jnp.stack([d[9][0] for d in rollout_data])
        lstm_c_all = jnp.stack([d[9][1] for d in rollout_data])

        # Compute advantages
        advantages = compute_gae(rewards_all, values_all, dones_all)
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        returns = advantages + values_all

        # Flatten: (num_steps, num_envs, ...) → (num_steps * num_envs, ...)
        bs = num_steps * num_envs
        batch = (
            spatial_all.reshape(bs, *spatial_all.shape[2:]),
            scalar_all.reshape(bs, *scalar_all.shape[2:]),
            lstm_h_all.reshape(bs, hidden_dim),
            lstm_c_all.reshape(bs, hidden_dim),
            masks_all.reshape(bs, *masks_all.shape[2:]),
            actions_all.reshape(bs, -1),
            logprobs_all.reshape(-1),
            advantages.reshape(-1),
            returns.reshape(-1),
        )

        # Shuffle and train on minibatches
        key, shuffle_key = jrandom.split(key)
        perm = jrandom.permutation(shuffle_key, bs)
        batch = tuple(x[perm] for x in batch)

        num_complete = bs // args.minibatch_size
        total_loss = 0.0
        for i in range(num_complete):
            start = i * args.minibatch_size
            end = start + args.minibatch_size
            minibatch = tuple(x[start:end] for x in batch)
            network, opt_state, loss = train_step(network, opt_state, minibatch, optimizer)
            total_loss += float(loss)

        elapsed = time.time() - t0

        if iteration % 10 == 0:
            avg_reward = float(rewards_all.mean())
            num_episodes = int(dones_all.sum())
            wins = int(jnp.sum(
                dones_all & jax.tree.map(lambda *xs: jnp.stack(xs), *infos_all).winner == 0
            )) if num_episodes > 0 else 0
            win_rate = wins / max(num_episodes, 1) * 100
            sps = (num_envs * num_steps) / elapsed
            print(
                f"Iter {iteration:4d} | Loss: {total_loss / max(num_complete, 1):.4f} | "
                f"Reward: {avg_reward:+.4f} | Episodes: {num_episodes:3d} | "
                f"Wins: {wins:2d}/{num_episodes} ({win_rate:.0f}%) | "
                f"SPS: {sps:7.0f} | Time: {elapsed:.2f}s"
            )

    # Save model
    import os
    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)
    eqx.tree_serialise_leaves(args.save_path, network)
    print(f"\nModel saved to: {args.save_path}")


if __name__ == "__main__":
    main()
