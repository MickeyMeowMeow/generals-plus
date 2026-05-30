"""
Memory state tracking for observation augmentation.

Replaces LSTM hidden state with 7 hand-crafted memory channels,
following the paper's approach (no recurrent state needed for PPO).

Channels:
  0: explored           — cells self has ever observed (monotonic)
  1: enemy_gen_discovered — where enemy generals were revealed
  2: cities_discovered  — where cities were revealed
  3: opponent_territory — where opponent was recently seen (snapshot)
  4: self_move_0        — most recent self move source position
  5: self_move_1        — 2nd most recent self move source
  6: self_move_2        — 3rd most recent self move source

Used in three contexts:
  1. RL rollout: MemoryState in scan carry, reset on episode end
  2. SFT replay: Track during re-simulation, record (obs+memory, action)
  3. Bot deployment: Maintain across ticks, reset on new game
"""

from typing import NamedTuple

import jax
import jax.numpy as jnp

from .types import Observation


class MemoryState(NamedTuple):
    """7 memory channels, each (H, W) float32 array."""

    explored: jnp.ndarray            # cells ever observed
    enemy_gen_discovered: jnp.ndarray  # enemy general locations revealed
    cities_discovered: jnp.ndarray    # city locations revealed
    opponent_territory: jnp.ndarray   # opponent cells currently visible
    self_move_0: jnp.ndarray         # most recent move source
    self_move_1: jnp.ndarray         # 2nd most recent move source
    self_move_2: jnp.ndarray         # 3rd most recent move source


def init_memory(H: int, W: int) -> MemoryState:
    """Create zero-initialized memory state for a grid of shape (H, W)."""
    zeros = jnp.zeros((H, W), dtype=jnp.float32)
    return MemoryState(
        explored=zeros,
        enemy_gen_discovered=zeros,
        cities_discovered=zeros,
        opponent_territory=zeros,
        self_move_0=zeros,
        self_move_1=zeros,
        self_move_2=zeros,
    )


@jax.jit
def update_memory(
    obs: Observation,
    action: jnp.ndarray,
    memory: MemoryState,
) -> MemoryState:
    """
    Update memory state given current observation and action taken.

    Args:
        obs: Current player observation (with fog of war).
        action: Action array [pass, row, col, direction, split].
        memory: Previous MemoryState.

    Returns:
        Updated MemoryState.
    """
    H, W = obs.owned_cells.shape

    # Cast to bool for logical ops (obs fields may be float32)
    owned = obs.owned_cells > 0.5
    opponent = obs.opponent_cells > 0.5
    neutral = obs.neutral_cells > 0.5
    gen = obs.generals > 0.5
    city = obs.cities > 0.5
    mtn = obs.mountains > 0.5
    fog = obs.fog_cells > 0.5

    # Visible cells = everything we can see (not fog)
    visible = jnp.logical_or(jnp.logical_or(owned, opponent),
                             jnp.logical_or(jnp.logical_or(neutral, gen),
                                            jnp.logical_or(city, mtn)))

    # 0: explored — monotonic, only grows
    new_explored = jnp.maximum(memory.explored, visible.astype(jnp.float32))

    # 1: enemy_gen_discovered — where enemy generals were revealed
    enemy_gen_visible = gen & opponent
    new_enemy_gen = jnp.maximum(memory.enemy_gen_discovered, enemy_gen_visible.astype(jnp.float32))

    # 2: cities_discovered — where cities were revealed (visible cities)
    city_visible = city & ~fog
    new_cities = jnp.maximum(memory.cities_discovered, city_visible.astype(jnp.float32))

    # 3: opponent_territory — snapshot of currently visible opponent cells
    new_opp_territory = opponent.astype(jnp.float32)

    # 4-6: self move history — shift and set new move source
    is_pass = action[0]
    row, col = action[1], action[2]

    # Create one-hot for current move source (only if not pass)
    move_source = jnp.zeros((H, W), dtype=jnp.float32)
    move_source = move_source.at[row, col].set(1.0 - is_pass.astype(jnp.float32))

    new_move_0 = move_source
    new_move_1 = memory.self_move_0
    new_move_2 = memory.self_move_1

    return MemoryState(
        explored=new_explored,
        enemy_gen_discovered=new_enemy_gen,
        cities_discovered=new_cities,
        opponent_territory=new_opp_territory,
        self_move_0=new_move_0,
        self_move_1=new_move_1,
        self_move_2=new_move_2,
    )


def memory_to_channels(memory: MemoryState) -> jnp.ndarray:
    """
    Stack memory channels into a (7, H, W) tensor for network input.

    Args:
        memory: MemoryState to convert.

    Returns:
        Float32 array of shape (7, H, W).
    """
    return jnp.stack([
        memory.explored,
        memory.enemy_gen_discovered,
        memory.cities_discovered,
        memory.opponent_territory,
        memory.self_move_0,
        memory.self_move_1,
        memory.self_move_2,
    ], axis=0).astype(jnp.float32)


def reset_memory_on_done(
    memory: MemoryState,
    done: jnp.ndarray,
) -> MemoryState:
    """
    Reset memory to zero for environments that are done.

    Args:
        memory: Current MemoryState (possibly batched in vmap context).
        done: Scalar boolean, True if episode ended.

    Returns:
        MemoryState, zeroed if done, unchanged otherwise.
    """
    H, W = memory.explored.shape
    zeros = init_memory(H, W)
    return jax.tree.map(
        lambda z, m: jnp.where(done, z, m),
        zeros,
        memory,
    )
