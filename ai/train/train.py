"""
PPO training with U-Net and memory channels for Generals Plus.

Uses the built-in ai/sim JAX environment (matching TS engine rules)
for vectorized self-play with opponent pool.

Key changes from previous version:
  - No LSTM: MemoryState (15 channels) replaces recurrent state
  - U-Net architecture with 24ch input (9 obs + 15 memory)
  - Potential-based reward shaping (optimal-policy-preserving)
  - Self-play with opponent pool (N=3) and win-rate gating
  - Variable grid sizes

Usage (from the ai/ directory):
    python -m train.train --grid-size 18 --num-envs 64
"""

import argparse
import os
import sys
import time

# Support running as `python -m train.train` from the ai/ directory
if __name__ == "__main__" and __package__ is None:
    _ai_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if _ai_dir not in sys.path:
        sys.path.insert(0, _ai_dir)

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx
import optax

from sim.action import compute_valid_move_mask
from sim.env import GeneralsEnv
from sim import game
from sim.types import Observation
from sim.rewards import potential_based_reward
from sim.memory import init_memory, update_memory, memory_to_channels, MemoryState, reset_memory_on_done

from train.network import UNetPolicyValueNetwork


def obs_to_spatial(obs: Observation) -> jnp.ndarray:
    """Convert Observation to (9, H, W) spatial tensor."""
    return jnp.stack([
        obs.armies, obs.generals, obs.cities, obs.mountains,
        obs.neutral_cells, obs.owned_cells, obs.opponent_cells,
        obs.fog_cells, obs.structures_in_fog,
    ], axis=0).astype(jnp.float32)


def build_24ch_input(obs: Observation, memory: MemoryState) -> jnp.ndarray:
    """Build 24-channel input: 9 obs + 15 memory channels."""
    obs_9ch = obs_to_spatial(obs)
    mem_15ch = memory_to_channels(memory)
    return jnp.concatenate([obs_9ch, mem_15ch], axis=0)  # (24, H, W)


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
# Opponent pool for self-play
# ---------------------------------------------------------------------------

class OpponentPool:
    """
    Manages N stored model checkpoints for self-play opponents.
    New model replaces oldest at >=45% win rate.
    """

    def __init__(self, pool_size: int = 3):
        self.pool_size = pool_size
        self.models = []       # list of UNetPolicyValueNetwork
        self.win_rates = []    # rolling win rate vs each pool model
        self.games_played = [] # games played vs each pool model

    def add_initial(self, model):
        """Add initial model to pool."""
        if len(self.models) < self.pool_size:
            # Deep copy the model
            self.models.append(eqx.filter_jit(lambda m: m)(model))
            self.win_rates.append(0.0)
            self.games_played.append(0)

    def get_opponent(self, key):
        """Sample a random opponent from the pool."""
        if not self.models:
            return None
        idx = jrandom.randint(key, (), 0, len(self.models))
        return self.models[int(idx)]

    def update(self, model, win_rate):
        """
        Try to add current model to pool.
        Replaces oldest if win_rate >= 45%.
        """
        if len(self.models) < self.pool_size:
            self.models.append(eqx.filter_jit(lambda m: m)(model))
            self.win_rates.append(win_rate)
            self.games_played.append(1)
        elif win_rate >= 0.45:
            # Replace oldest
            self.models.pop(0)
            self.win_rates.pop(0)
            self.games_played.pop(0)
            self.models.append(eqx.filter_jit(lambda m: m)(model))
            self.win_rates.append(win_rate)
            self.games_played.append(1)


# ---------------------------------------------------------------------------
# Rollout
# ---------------------------------------------------------------------------

def make_rollout_step(network, opponent_network=None):
    """Create a jitted rollout step with memory state."""

    @jax.jit
    def rollout_step(carry, _):
        states, memories, key = carry
        num_envs = states.armies.shape[0]

        # Observations for both players
        obs_p0 = jax.vmap(lambda s: game.get_observation(s, 0))(states)
        obs_p1 = jax.vmap(lambda s: game.get_observation(s, 1))(states)

        # Build 24ch inputs for player 0
        obs_24ch = jax.vmap(build_24ch_input)(obs_p0, memories)

        # Valid move masks
        masks = jax.vmap(lambda o: compute_valid_move_mask(
            o.armies, o.owned_cells, o.mountains))(obs_p0)

        # Network forward pass
        key, *env_keys = jrandom.split(key, num_envs + 1)
        actions_p0, values, logprobs, entropies = jax.vmap(
            lambda o, m, k: network(o, m, k, None)
        )(obs_24ch, masks, jnp.stack(env_keys))

        # Opponent actions
        key, *opp_keys = jrandom.split(key, num_envs + 1)
        if opponent_network is not None:
            # Self-play: use opponent network (argmax via inference)
            obs_24ch_p1 = jax.vmap(build_24ch_input)(obs_p1, memories)  # simplified: share memory
            masks_p1 = jax.vmap(lambda o: compute_valid_move_mask(
                o.armies, o.owned_cells, o.mountains))(obs_p1)
            actions_p1, _ = jax.vmap(
                lambda o, m: opponent_network.inference(o, m)
            )(obs_24ch_p1, masks_p1)
        else:
            # Random opponent
            actions_p1 = jax.vmap(random_action)(jnp.stack(opp_keys), obs_p1)

        # Step game
        actions = jnp.stack([actions_p0, actions_p1], axis=1)
        new_states, infos = jax.vmap(game.step)(states, actions)

        # Get new observations for reward
        obs_p0_new = jax.vmap(lambda s: game.get_observation(s, 0))(new_states)

        # Compute rewards
        rewards = jax.vmap(potential_based_reward)(obs_p0, actions_p0, obs_p0_new)

        # Done
        terminated = infos.is_done
        truncated = (new_states.time >= 500) & ~terminated
        dones = terminated | truncated

        # Update memory
        new_memories = jax.vmap(update_memory)(obs_p0, actions_p0, memories)

        # Reset memory for done envs
        new_memories = jax.vmap(reset_memory_on_done)(new_memories, dones)

        carry = (new_states, new_memories, key)
        return carry, (obs_24ch, masks, actions_p0, logprobs, values, rewards, dones, infos)

    return rollout_step


# ---------------------------------------------------------------------------
# PPO loss
# ---------------------------------------------------------------------------

@eqx.filter_jit
def ppo_loss(network, obs_24ch, mask, action, old_logprob, advantage, ret, clip=0.2):
    """PPO loss for a single sample."""
    _, value, logprob, entropy = network(obs_24ch, mask, jrandom.PRNGKey(0), action)

    ratio = jnp.exp(logprob - old_logprob)
    clipped = jnp.clip(ratio, 1 - clip, 1 + clip) * advantage
    policy_loss = -jnp.minimum(ratio * advantage, clipped)

    value_loss = 0.5 * (value - ret) ** 2
    entropy_loss = -0.01 * entropy

    return policy_loss + value_loss + entropy_loss


def train_step(network, opt_state, batch, optimizer):
    """Single training step on a minibatch."""
    obs_24ch, masks, actions, old_logprobs, advantages, returns = batch

    def loss_fn(net):
        losses = jax.vmap(
            lambda o, m, a, olp, adv, r: ppo_loss(net, o, m, a, olp, adv, r)
        )(obs_24ch, masks, actions, old_logprobs, advantages, returns)
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
    parser.add_argument("--grid-size", type=int, default=18, help="Grid size (square)")
    parser.add_argument("--num-envs", type=int, default=256, help="Number of parallel environments")
    parser.add_argument("--num-steps", type=int, default=128, help="Steps per rollout")
    parser.add_argument("--num-iterations", type=int, default=500, help="Training iterations")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--minibatch-size", type=int, default=256, help="Minibatch size")
    parser.add_argument("--save-path", default="models/ppo_unet.eqx", help="Model save path")
    parser.add_argument("--load-path", default=None, help="Load pretrained model (SFT)")
    parser.add_argument("--opponent", default="random", choices=["random", "self-play"],
                        help="Opponent type")
    parser.add_argument("--pool-size", type=int, default=3, help="Opponent pool size for self-play")
    args = parser.parse_args()

    grid_size = args.grid_size
    num_envs = args.num_envs
    num_steps = args.num_steps

    print(f"Generals Plus — PPO with U-Net + Memory Channels")
    print(f"Grid:          {grid_size}x{grid_size}")
    print(f"Environments:  {num_envs}")
    print(f"Device:        {jax.devices()[0]}")
    print(f"Opponent:      {args.opponent}")
    print()

    # Initialize network
    key = jrandom.PRNGKey(42)
    key, net_key = jrandom.split(key)
    network = UNetPolicyValueNetwork(net_key, grid_size=grid_size)

    if args.load_path:
        network = eqx.tree_deserialise_leaves(args.load_path, network)
        print(f"Loaded pretrained weights from {args.load_path}")

    optimizer = optax.adam(args.lr)
    opt_state = optimizer.init(eqx.filter(network, eqx.is_array))

    params, _ = eqx.partition(network, eqx.is_array)
    num_params = sum(x.size for x in jax.tree.leaves(params))
    print(f"Parameters: {num_params:,}")
    print()

    # Opponent pool
    pool = OpponentPool(pool_size=args.pool_size)
    if args.opponent == "self-play":
        pool.add_initial(network)

    # Initialize environment
    env = GeneralsEnv(grid_dims=(grid_size, grid_size), truncation=500)
    key, pool_key, init_key = jrandom.split(key, 3)
    _, _ = env.reset(pool_key)
    key, *state_keys = jrandom.split(key, num_envs + 1)
    states = jax.vmap(env.init_state)(jnp.stack(state_keys))

    # Initialize memory states (read actual grid size from env state)
    H, W = states.armies.shape[1], states.armies.shape[2]
    _single_mem = init_memory(H, W)
    memories = jax.tree.map(lambda x: jnp.stack([x] * num_envs), _single_mem)

    # Warmup
    print("Warming up...")
    opponent = pool.get_opponent(key) if args.opponent == "self-play" else None
    rollout_step = make_rollout_step(network, opponent)
    carry = (states, memories, key)
    for _ in range(3):
        carry, _ = rollout_step(carry, None)
    jax.block_until_ready(carry[0])
    print("Training...\n")

    for iteration in range(args.num_iterations):
        t0 = time.time()

        # Get opponent for this iteration
        if args.opponent == "self-play" and pool.models:
            key, opp_key = jrandom.split(key)
            opponent = pool.get_opponent(opp_key)
        else:
            opponent = None

        rollout_step = make_rollout_step(network, opponent)

        # Collect rollout
        carry = (states, memories, key)
        rollout_data = []
        for _ in range(num_steps):
            carry, data = rollout_step(carry, None)
            rollout_data.append(data)

        states, memories, key = carry
        jax.block_until_ready(states)

        # Stack rollout data
        obs_all = jnp.stack([d[0] for d in rollout_data])
        masks_all = jnp.stack([d[1] for d in rollout_data])
        actions_all = jnp.stack([d[2] for d in rollout_data])
        logprobs_all = jnp.stack([d[3] for d in rollout_data])
        values_all = jnp.stack([d[4] for d in rollout_data])
        rewards_all = jnp.stack([d[5] for d in rollout_data])
        dones_all = jnp.stack([d[6] for d in rollout_data])
        infos_all = [d[7] for d in rollout_data]

        # Compute advantages
        advantages = compute_gae(rewards_all, values_all, dones_all)
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        returns = advantages + values_all

        # Flatten
        bs = num_steps * num_envs
        batch = (
            obs_all.reshape(bs, *obs_all.shape[2:]),
            masks_all.reshape(bs, *masks_all.shape[2:]),
            actions_all.reshape(bs, -1),
            logprobs_all.reshape(-1),
            advantages.reshape(-1),
            returns.reshape(-1),
        )

        # Shuffle and train
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
            infos_stacked = jax.tree.map(lambda *xs: jnp.stack(xs), *infos_all)
            wins = int(jnp.sum(dones_all & (infos_stacked.winner == 0))) if num_episodes > 0 else 0
            win_rate = wins / max(num_episodes, 1) * 100
            sps = (num_envs * num_steps) / elapsed
            print(
                f"Iter {iteration:4d} | Loss: {total_loss / max(num_complete, 1):.4f} | "
                f"Reward: {avg_reward:+.4f} | Episodes: {num_episodes:3d} | "
                f"Wins: {wins:2d}/{num_episodes} ({win_rate:.0f}%) | "
                f"SPS: {sps:7.0f} | Time: {elapsed:.2f}s"
            )

            # Update opponent pool
            if args.opponent == "self-play" and num_episodes > 0:
                pool.update(network, win_rate / 100.0)

    # Save model
    import os
    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)
    eqx.tree_serialise_leaves(args.save_path, network)
    print(f"\nModel saved to: {args.save_path}")


if __name__ == "__main__":
    main()
