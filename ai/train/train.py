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
import re
import sys
import time
from threading import Thread
from tqdm import tqdm as _tqdm

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

# Enable bf16 matmul precision (A800 native, fp32 weights/gradients/optimizer).
# Safe for ONNX export: export_onnx.py uses tf.float32 input signature.
jax.config.update("jax_default_matmul_precision", "bfloat16")

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
        Returns True if pool was updated.
        """
        if len(self.models) < self.pool_size:
            self.models.append(eqx.filter_jit(lambda m: m)(model))
            self.win_rates.append(win_rate)
            self.games_played.append(1)
            return True
        elif win_rate >= 0.45:
            # Replace oldest
            self.models.pop(0)
            self.win_rates.pop(0)
            self.games_played.pop(0)
            self.models.append(eqx.filter_jit(lambda m: m)(model))
            self.win_rates.append(win_rate)
            self.games_played.append(1)
            return True
        return False


# ---------------------------------------------------------------------------
# Rollout (lax.scan for fused XLA computation)
# ---------------------------------------------------------------------------

def _make_rollout_body_random(network, reset_pool):
    """Create scan body for random-opponent rollout with auto-reset."""

    pool_size = reset_pool.armies.shape[0]

    def scan_body(carry, _):
        states, memories, key = carry
        num_envs = states.armies.shape[0]

        obs_p0 = jax.vmap(lambda s: game.get_observation(s, 0))(states)
        obs_p1 = jax.vmap(lambda s: game.get_observation(s, 1))(states)

        # Build 24ch inputs for player 0
        obs_24ch = jax.vmap(build_24ch_input)(obs_p0, memories)

        masks = jax.vmap(lambda o: compute_valid_move_mask(
            o.armies, o.owned_cells, o.mountains))(obs_p0)

        key, *env_keys = jrandom.split(key, num_envs + 1)
        actions_p0, values, logprobs, entropies = jax.vmap(
            lambda o, m, k: network(o, m, k, None)
        )(obs_24ch, masks, jnp.stack(env_keys))

        # Random opponent
        key, *opp_keys = jrandom.split(key, num_envs + 1)
        actions_p1 = jax.vmap(random_action)(jnp.stack(opp_keys), obs_p1)

        actions = jnp.stack([actions_p0, actions_p1], axis=1)
        new_states, infos = jax.vmap(game.step)(states, actions)

        obs_p0_new = jax.vmap(lambda s: game.get_observation(s, 0))(new_states)
        rewards = jax.vmap(potential_based_reward)(obs_p0, actions_p0, obs_p0_new)

        terminated = infos.is_done
        truncated = (new_states.time >= 500) & ~terminated
        dones = terminated | truncated

        # Auto-reset: sample from pre-generated state pool
        key, reset_key = jrandom.split(key)
        pool_indices = jrandom.randint(reset_key, (num_envs,), 0, pool_size)
        reset_states = jax.tree.map(lambda x: x[pool_indices], reset_pool)
        new_states = jax.tree.map(
            lambda r, c: jnp.where(
                dones.reshape((-1,) + (1,) * (c.ndim - 1)), r, c),
            reset_states, new_states,
        )

        new_memories = jax.vmap(update_memory)(obs_p0, actions_p0, memories)
        new_memories = jax.vmap(reset_memory_on_done)(new_memories, dones)

        carry_new = (new_states, new_memories, key)
        return carry_new, (obs_24ch, masks, actions_p0, logprobs, values,
                           rewards, dones, infos)

    return scan_body


def _make_rollout_body_selfplay(network, opponent_network, reset_pool):
    """Create scan body for self-play opponent rollout with auto-reset."""

    pool_size = reset_pool.armies.shape[0]

    def scan_body(carry, _):
        states, memories, memories_p1, key = carry
        num_envs = states.armies.shape[0]

        obs_p0 = jax.vmap(lambda s: game.get_observation(s, 0))(states)
        obs_p1 = jax.vmap(lambda s: game.get_observation(s, 1))(states)

        obs_24ch = jax.vmap(build_24ch_input)(obs_p0, memories)

        masks = jax.vmap(lambda o: compute_valid_move_mask(
            o.armies, o.owned_cells, o.mountains))(obs_p0)

        key, *env_keys = jrandom.split(key, num_envs + 1)
        actions_p0, values, logprobs, entropies = jax.vmap(
            lambda o, m, k: network(o, m, k, None)
        )(obs_24ch, masks, jnp.stack(env_keys))

        # Self-play opponent (argmax inference) — uses its own memory
        obs_24ch_p1 = jax.vmap(build_24ch_input)(obs_p1, memories_p1)
        masks_p1 = jax.vmap(lambda o: compute_valid_move_mask(
            o.armies, o.owned_cells, o.mountains))(obs_p1)
        actions_p1, _ = jax.vmap(
            lambda o, m: opponent_network.inference(o, m)
        )(obs_24ch_p1, masks_p1)

        actions = jnp.stack([actions_p0, actions_p1], axis=1)
        new_states, infos = jax.vmap(game.step)(states, actions)

        obs_p0_new = jax.vmap(lambda s: game.get_observation(s, 0))(new_states)
        rewards = jax.vmap(potential_based_reward)(obs_p0, actions_p0, obs_p0_new)

        terminated = infos.is_done
        truncated = (new_states.time >= 500) & ~terminated
        dones = terminated | truncated

        # Auto-reset: sample from pre-generated state pool
        key, reset_key = jrandom.split(key)
        pool_indices = jrandom.randint(reset_key, (num_envs,), 0, pool_size)
        reset_states = jax.tree.map(lambda x: x[pool_indices], reset_pool)
        new_states = jax.tree.map(
            lambda r, c: jnp.where(
                dones.reshape((-1,) + (1,) * (c.ndim - 1)), r, c),
            reset_states, new_states,
        )

        new_memories = jax.vmap(update_memory)(obs_p0, actions_p0, memories)
        new_memories = jax.vmap(reset_memory_on_done)(new_memories, dones)

        new_memories_p1 = jax.vmap(update_memory)(obs_p1, actions_p1, memories_p1)
        new_memories_p1 = jax.vmap(reset_memory_on_done)(new_memories_p1, dones)

        carry_new = (new_states, new_memories, new_memories_p1, key)
        return carry_new, (obs_24ch, masks, actions_p0, logprobs, values,
                           rewards, dones, infos)

    return scan_body


def run_rollout(states, memories, key, network, opponent_network, num_steps, reset_pool, memories_p1=None):
    """Run a full rollout using lax.scan (single fused XLA computation).

    Replaces the old Python for-loop + per-step jit pattern.
    Includes auto-reset: done games are immediately replaced from reset_pool.
    """
    if opponent_network is not None:
        body = _make_rollout_body_selfplay(network, opponent_network, reset_pool)
        carry = (states, memories, memories_p1, key)
    else:
        body = _make_rollout_body_random(network, reset_pool)
        carry = (states, memories, key)

    carry, data = jax.lax.scan(body, carry, None, length=num_steps)
    return carry, data


# ---------------------------------------------------------------------------
# PPO loss + fused training epoch
# ---------------------------------------------------------------------------

def ppo_loss_fn(network, obs_24ch, mask, action, old_logprob, advantage, ret, clip=0.2, value_coef=0.05):
    """PPO loss for a single sample. Returns (total, policy, value, entropy) parts."""
    _, value, logprob, entropy = network(obs_24ch, mask, jrandom.PRNGKey(0), action)

    ratio = jnp.exp(logprob - old_logprob)
    clipped = jnp.clip(ratio, 1 - clip, 1 + clip) * advantage
    policy_loss = -jnp.minimum(ratio * advantage, clipped)

    value_loss = 0.5 * (value - ret) ** 2
    entropy_loss = -0.01 * entropy

    return policy_loss + value_coef * value_loss + entropy_loss, policy_loss, value_loss, entropy_loss


def make_train_epoch(optimizer, minibatch_size, clip=0.2, grad_scale_mask=None, value_coef=0.05):
    """Create a JIT-compiled training function that fuses all minibatch steps
    into a single XLA program via ``jax.lax.scan``.

    ``grad_scale_mask`` is an optional pytree of scalars that multiplies
    gradients before the optimizer step.  Used to give value head params
    a larger effective learning rate.
    """
    @eqx.filter_jit
    def train_epoch(network, opt_state, batch):
        obs_24ch, masks, actions, old_logprobs, advantages, returns = batch
        bs = obs_24ch.shape[0]
        num_mb = bs // minibatch_size
        trim = num_mb * minibatch_size

        # Reshape batch into (num_mb, mb_size, ...)
        mb_data = (
            obs_24ch[:trim].reshape(num_mb, minibatch_size, *obs_24ch.shape[1:]),
            masks[:trim].reshape(num_mb, minibatch_size, *masks.shape[1:]),
            actions[:trim].reshape(num_mb, minibatch_size, *actions.shape[1:]),
            old_logprobs[:trim].reshape(num_mb, minibatch_size),
            advantages[:trim].reshape(num_mb, minibatch_size),
            returns[:trim].reshape(num_mb, minibatch_size),
        )

        # Partition: only array leaves go through scan carry
        diff, static = eqx.partition(network, eqx.is_array)

        @jax.checkpoint
        def scan_step(carry, mb):
            diff, opt_state = carry
            mb_o, mb_m, mb_a, mb_lp, mb_adv, mb_ret = mb

            def loss_fn(d):
                net = eqx.combine(d, static)
                tot, pol, val, ent = jax.vmap(
                    lambda o, m, a, olp, adv, r: ppo_loss_fn(net, o, m, a, olp, adv, r, clip, value_coef)
                )(mb_o, mb_m, mb_a, mb_lp, mb_adv, mb_ret)
                return jnp.mean(tot), (jnp.mean(pol), jnp.mean(val), jnp.mean(ent))

            (total, (policy_l, value_l, entropy_l)), grads = jax.value_and_grad(
                loss_fn, has_aux=True,
            )(diff)
            # Scale gradients for value head parameters
            if grad_scale_mask is not None:
                grads = jax.tree.map(lambda g, s: g * s, grads, grad_scale_mask)
            updates, opt_state = optimizer.update(grads, opt_state, diff)
            diff = optax.apply_updates(diff, updates)
            return (diff, opt_state), (total, policy_l, value_l, entropy_l)

        (diff, opt_state), (totals, pol_losses, val_losses, ent_losses) = jax.lax.scan(
            scan_step, (diff, opt_state), mb_data,
        )
        network = eqx.combine(diff, static)
        return network, opt_state, jnp.mean(totals), jnp.mean(pol_losses), jnp.mean(val_losses), jnp.mean(ent_losses)

    return train_epoch


# ---------------------------------------------------------------------------
# GAE
# ---------------------------------------------------------------------------

@jax.jit
def compute_gae(rewards, values, dones, next_values, gamma=0.99, lam=0.95):
    """Compute advantages using GAE.

    Args:
        rewards: (num_steps, num_envs)
        values: (num_steps, num_envs) — V(s_t) from rollout.
        dones: (num_steps, num_envs)
        next_values: (num_envs,) — V(s_{T+1}) computed after rollout for bootstrap.
    """
    num_steps, num_envs = rewards.shape
    advantages = jnp.zeros_like(rewards)
    last_adv = jnp.zeros(num_envs)

    for t in reversed(range(num_steps)):
        next_value = jnp.where(t == num_steps - 1, next_values, values[t + 1])
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
    parser.add_argument("--resume", default=None, help="Resume from checkpoint .eqx file")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--value-lr-scale", type=float, default=1.0, help="Value head LR multiplier")
    parser.add_argument("--minibatch-size", type=int, default=256, help="Minibatch size")
    parser.add_argument("--clip", type=float, default=0.2, help="PPO clip range")
    parser.add_argument("--value-coef", type=float, default=0.05, help="Value loss coefficient")
    parser.add_argument("--save-path", default="models/ppo_unet.eqx", help="Model save path")
    parser.add_argument("--load-path", default=None, help="Load pretrained model (SFT)")
    parser.add_argument("--opponent", default="random", choices=["random", "self-play"],
                        help="Opponent type")
    parser.add_argument("--pool-size", type=int, default=3, help="Opponent pool size for self-play")
    parser.add_argument("--ch1", type=int, default=96, help="Encoder level-1 channels (must match --load-path)")
    parser.add_argument("--ch2", type=int, default=192, help="Encoder level-2 channels (must match --load-path)")
    parser.add_argument("--ch-bot", type=int, default=384, help="Bottleneck channels (must match --load-path)")
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
    start_iter = 0

    if args.resume:
        key, net_key = jrandom.split(key)
        network = UNetPolicyValueNetwork(net_key, grid_size=grid_size, ch1=args.ch1, ch2=args.ch2, ch_bot=args.ch_bot)
        network = eqx.tree_deserialise_leaves(args.resume, network)
        # Load optimizer state from companion file
        opt_path = args.resume.replace(".eqx", ".opt")
        optimizer = optax.adam(args.lr)
        opt_state = optimizer.init(eqx.filter(network, eqx.is_array))
        if os.path.exists(opt_path):
            opt_state = eqx.tree_deserialise_leaves(opt_path, opt_state)
        # Extract iteration number from filename
        m = re.search(r"checkpoint_(\d+)", args.resume)
        if m:
            start_iter = int(m.group(1))
        print(f"Resumed from {args.resume} (iteration {start_iter})")
    elif args.load_path:
        key, net_key = jrandom.split(key)
        network = UNetPolicyValueNetwork(net_key, grid_size=grid_size, ch1=args.ch1, ch2=args.ch2, ch_bot=args.ch_bot)
        network = eqx.tree_deserialise_leaves(args.load_path, network)
        print(f"Loaded pretrained weights from {args.load_path}")
        optimizer = optax.adam(args.lr)
        opt_state = optimizer.init(eqx.filter(network, eqx.is_array))
    else:
        key, net_key = jrandom.split(key)
        network = UNetPolicyValueNetwork(net_key, grid_size=grid_size, ch1=args.ch1, ch2=args.ch2, ch_bot=args.ch_bot)
        optimizer = optax.adam(args.lr)
        opt_state = optimizer.init(eqx.filter(network, eqx.is_array))

    params, _ = eqx.partition(network, eqx.is_array)
    num_params = sum(x.size for x in jax.tree.leaves(params))
    print(f"Parameters: {num_params:,}")
    print()

    # Checkpoint config
    CHECKPOINT_INTERVAL = 25
    CHECKPOINT_KEEP = 3
    best_win_rate = -1.0
    saved_checkpoints = []

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
    memories_p1 = jax.tree.map(lambda x: jnp.stack([x] * num_envs), _single_mem)

    # Pre-generate state pool for auto-reset (avoids calling generate_grid
    # inside lax.scan, which would run every step even for non-done envs).
    POOL_SIZE = num_envs * 20  # generous pool
    key, pool_key = jrandom.split(key)
    pool_keys = jrandom.split(pool_key, POOL_SIZE)
    reset_pool = jax.vmap(env.init_state)(pool_keys)  # shape: (POOL_SIZE, ...)
    _pool_idx = jnp.zeros(num_envs, dtype=jnp.int32)   # per-env pool cursor

    # Warmup — compile rollout + train_epoch (first-run JIT compilation)
    print("Warming up (JIT compilation)...")
    opponent = pool.get_opponent(key) if args.opponent == "self-play" else None
    carry, _ = run_rollout(states, memories, key, network, opponent, num_steps=3, reset_pool=reset_pool,
                           memories_p1=memories_p1 if opponent is not None else None)
    jax.block_until_ready(carry[0])

    # Build gradient scaling mask: value_lr_scale for value head, 1.0 elsewhere.
    # This effectively gives value parameters a higher LR without changing the optimizer.
    _value_param_names = {"value_fc1", "value_fc2"}
    def _make_scale_mask(path, _):
        # Equinox module fields appear as NamedSequenceKey in the path
        for key in path:
            if hasattr(key, 'name') and key.name in _value_param_names:
                return jnp.float32(args.value_lr_scale)
            # Also check idx-based access: NamedSequenceKey has .idx
        # Fallback: check string representation
        path_str = str(path)
        for name in _value_param_names:
            if name in path_str:
                return jnp.float32(args.value_lr_scale)
        return jnp.float32(1.0)

    diff_template = eqx.filter(network, eqx.is_array)
    grad_scale_mask = jax.tree.map_with_path(_make_scale_mask, diff_template) \
        if args.value_lr_scale != 1.0 else None

    if args.value_lr_scale != 1.0:
        n_value = sum(1 for _ in jax.tree.leaves(grad_scale_mask)
                      if float(_) != 1.0)
        print(f"Value LR scale: {args.value_lr_scale}x ({n_value} param tensors)")

    train_epoch = make_train_epoch(optimizer, args.minibatch_size,
                                   clip=args.clip,
                                   grad_scale_mask=grad_scale_mask,
                                   value_coef=args.value_coef)
    print("Training...\n")

    pbar = _tqdm(range(start_iter, args.num_iterations),
                  desc="PPO", unit="iter", dynamic_ncols=True)

    # Background thread handle for async checkpoint saves
    _save_thread = None

    # Sliding window for pool update decisions (reduce noisy per-iter updates)
    WIN_WINDOW = 20
    _win_history = []

    for iteration in pbar:
        t0 = time.time()

        # Wait for previous async checkpoint to finish before modifying model
        if _save_thread is not None:
            _save_thread.join()
            _save_thread = None

        # Get opponent for this iteration
        if args.opponent == "self-play" and pool.models:
            key, opp_key = jrandom.split(key)
            opponent = pool.get_opponent(opp_key)
        else:
            opponent = None

        # Run full rollout via lax.scan (single fused XLA computation)
        carry, rollout_data = run_rollout(
            states, memories, key, network, opponent, num_steps, reset_pool=reset_pool,
            memories_p1=memories_p1 if opponent is not None else None,
        )
        if opponent is not None:
            states, memories, memories_p1, key = carry
        else:
            states, memories, key = carry

        # rollout_data is pre-stacked by lax.scan: (num_steps, num_envs, ...)
        obs_all = rollout_data[0]
        masks_all = rollout_data[1]
        actions_all = rollout_data[2]
        logprobs_all = rollout_data[3]
        values_all = rollout_data[4]
        rewards_all = rollout_data[5]
        dones_all = rollout_data[6]
        infos_all = rollout_data[7]

        # Compute bootstrap values V(s_{T+1}) from final states
        obs_p0_final = jax.vmap(lambda s: game.get_observation(s, 0))(states)
        obs_24ch_final = jax.vmap(build_24ch_input)(obs_p0_final, memories)
        masks_final = jax.vmap(lambda o: compute_valid_move_mask(
            o.armies, o.owned_cells, o.mountains))(obs_p0_final)
        _, bootstrap_values, _, _ = jax.vmap(
            lambda o, m: network(o, m, jrandom.PRNGKey(0), None)
        )(obs_24ch_final, masks_final)
        # Done envs at last step: game ended, no future value
        bootstrap_values = bootstrap_values * (1.0 - dones_all[-1])

        # Compute advantages
        advantages = compute_gae(rewards_all, values_all, dones_all, bootstrap_values)
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

        # Shuffle
        key, shuffle_key = jrandom.split(key)
        perm = jrandom.permutation(shuffle_key, bs)
        batch = tuple(x[perm] for x in batch)

        # --- Fused training: all minibatches in one XLA program (no GIL) ---
        network, opt_state, avg_loss_jax, pol_loss_jax, val_loss_jax, ent_loss_jax = train_epoch(network, opt_state, batch)

        # --- Batch all metrics into a single GPU→CPU transfer ---
        metrics_jax = jax.device_get((
            avg_loss_jax,
            pol_loss_jax,
            val_loss_jax,
            ent_loss_jax,
            rewards_all.mean(),
            dones_all.sum().astype(jnp.float32),
            jnp.sum(dones_all & (infos_all.winner == 0)).astype(jnp.float32),
            advantages.mean(),
        ))

        elapsed = time.time() - t0
        avg_loss = float(metrics_jax[0])
        pol_loss = float(metrics_jax[1])
        val_loss = float(metrics_jax[2])
        ent_loss = float(metrics_jax[3])
        avg_reward = float(metrics_jax[4])
        num_episodes = max(int(metrics_jax[5]), 0)
        wins = max(int(metrics_jax[6]), 0) if num_episodes > 0 else 0
        avg_adv = float(metrics_jax[7])
        win_rate = wins / max(num_episodes, 1) * 100
        sps = (num_envs * num_steps) / elapsed

        pbar.set_postfix(
            loss=f"{avg_loss:.3f}",
            p=f"{pol_loss:.3f}",
            vmse=f"{val_loss / 0.5:.3f}",
            e=f"{ent_loss:.3f}",
            adv=f"{avg_adv:+.3f}",
            reward=f"{avg_reward:+.3f}",
            win=f"{win_rate:.0f}%({wins}/{num_episodes})",
            sps=f"{sps:.0f}",
            t=f"{elapsed:.1f}s",
        )

        # Update opponent pool (smoothed: use sliding-window avg to reduce noise)
        if args.opponent == "self-play" and num_episodes > 0:
            _win_history.append(win_rate / 100.0)
            if len(_win_history) > WIN_WINDOW:
                _win_history.pop(0)
            if len(_win_history) >= WIN_WINDOW:
                avg_win = sum(_win_history) / len(_win_history)
                if pool.update(network, avg_win):
                    pbar.write(f"  ★ Pool updated at iter {iteration}: avg_win={avg_win:.1%} (pool size={len(pool.models)})")
                    sys.stdout.flush()
                    _win_history.clear()

        # Checkpoint (async file I/O — doesn't block GPU)
        if (iteration + 1) % CHECKPOINT_INTERVAL == 0:
            ckpt_path = f"models/checkpoint_{iteration + 1}.eqx"
            opt_ckpt_path = ckpt_path.replace(".eqx", ".opt")
            # Copy to CPU numpy arrays, then save in background thread
            net_cpu = jax.device_get(network)
            opt_cpu = jax.device_get(opt_state)

            def _async_save():
                eqx.tree_serialise_leaves(ckpt_path, net_cpu)
                eqx.tree_serialise_leaves(opt_ckpt_path, opt_cpu)

            _save_thread = Thread(target=_async_save, daemon=True)
            _save_thread.start()
            saved_checkpoints.append(ckpt_path)
            pbar.write(f"  ↗ Checkpoint: {ckpt_path}")
            # Rotate: keep only N most recent
            while len(saved_checkpoints) > CHECKPOINT_KEEP:
                old = saved_checkpoints.pop(0)
                old_opt = old.replace(".eqx", ".opt")
                if os.path.exists(old):
                    os.remove(old)
                if os.path.exists(old_opt):
                    os.remove(old_opt)

        # Track best model by win rate
        if num_episodes > 0 and win_rate > best_win_rate:
            best_win_rate = win_rate
            eqx.tree_serialise_leaves("models/best.eqx", network)

    # Wait for final checkpoint to finish saving
    if _save_thread is not None:
        _save_thread.join()

    pbar.close()

    # Save final model
    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)
    eqx.tree_serialise_leaves(args.save_path, network)
    print(f"\nModel saved to: {args.save_path}")


if __name__ == "__main__":
    main()
