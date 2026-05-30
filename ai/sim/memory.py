"""
Memory state tracking for observation augmentation.

Replaces LSTM hidden state with 15 hand-crafted memory channels,
following the paper's approach (no recurrent state needed for PPO).

Paper §5 Memory Augmentation:
  (1) positions of castles/generals revealed → enemy_gen_discovered, cities_discovered
  (2) explored cells → explored
  (3) cells opponent has seen → opponent_explored
  (4) last 7 moves → self_move_0..6

Plus failure-mode mitigation channels:
  (12) bfs_dist_enemy_gen — BFS distance to known enemy general (dead-end avoidance)
  (13) bfs_dist_city — BFS distance to nearest known city
  (14) threat_heatmap — enemy army density (threat awareness)

Channels:
   0: explored              — cells self has ever observed (monotonic)
   1: enemy_gen_discovered  — where enemy generals were revealed (monotonic)
   2: cities_discovered     — where cities were revealed (monotonic)
   3: opponent_territory    — where opponent was recently seen (snapshot)
   4: self_move_0           — most recent self move source position
   5: self_move_1           — 2nd most recent self move
   6: self_move_2           — 3rd most recent self move
   7: self_move_3           — 4th most recent self move
   8: self_move_4           — 5th most recent self move
   9: self_move_5           — 6th most recent self move
  10: self_move_6           — 7th most recent self move
  11: opponent_explored     — cells opponent has seen (monotonic, paper item 3)
  12: bfs_dist_enemy_gen    — BFS distance to known enemy general [0,1]
  13: bfs_dist_city         — BFS distance to nearest known city [0,1]
  14: threat_heatmap        — enemy army density in 5×5 Chebyshev radius [0,1]

Used in three contexts:
  1. RL rollout: MemoryState in scan carry, reset on episode end
  2. SFT replay: Track during re-simulation, record (obs+memory, action)
  3. Bot deployment: Maintain across ticks, reset on new game
"""

from typing import NamedTuple

import jax
import jax.numpy as jnp
from jax import lax

from .game import compute_bfs_distance, compute_visibility
from .types import Observation

# ---------------------------------------------------------------------------
# Channel count constants
# ---------------------------------------------------------------------------

NUM_OBS_CHANNELS = 9
NUM_MEMORY_CHANNELS = 15
NUM_TOTAL_CHANNELS = NUM_OBS_CHANNELS + NUM_MEMORY_CHANNELS  # 24


# ---------------------------------------------------------------------------
# MemoryState
# ---------------------------------------------------------------------------

class MemoryState(NamedTuple):
    """15 memory channels, each (H, W) float32 array."""

    explored: jnp.ndarray              # cells ever observed
    enemy_gen_discovered: jnp.ndarray  # enemy general locations revealed
    cities_discovered: jnp.ndarray     # city locations revealed
    opponent_territory: jnp.ndarray    # opponent cells currently visible
    self_move_0: jnp.ndarray           # most recent move source
    self_move_1: jnp.ndarray           # 2nd most recent move source
    self_move_2: jnp.ndarray           # 3rd most recent move source
    self_move_3: jnp.ndarray           # 4th most recent move source
    self_move_4: jnp.ndarray           # 5th most recent move source
    self_move_5: jnp.ndarray           # 6th most recent move source
    self_move_6: jnp.ndarray           # 7th most recent move source
    opponent_explored: jnp.ndarray     # cells opponent has seen (paper item 3)
    bfs_dist_enemy_gen: jnp.ndarray    # BFS distance to known enemy general
    bfs_dist_city: jnp.ndarray         # BFS distance to nearest known city
    threat_heatmap: jnp.ndarray        # enemy army density heatmap


# ---------------------------------------------------------------------------
# Init / reset
# ---------------------------------------------------------------------------

def init_memory(H: int, W: int) -> MemoryState:
    """Create zero-initialized memory state for a grid of shape (H, W)."""
    zeros = jnp.zeros((H, W), dtype=jnp.float32)
    # BFS distance and threat channels default to 1.0 = "far/unknown"
    ones = jnp.ones((H, W), dtype=jnp.float32)
    return MemoryState(
        explored=zeros,
        enemy_gen_discovered=zeros,
        cities_discovered=zeros,
        opponent_territory=zeros,
        self_move_0=zeros,
        self_move_1=zeros,
        self_move_2=zeros,
        self_move_3=zeros,
        self_move_4=zeros,
        self_move_5=zeros,
        self_move_6=zeros,
        opponent_explored=zeros,
        bfs_dist_enemy_gen=ones,      # 1.0 = unknown (far)
        bfs_dist_city=ones,           # 1.0 = unknown (far)
        threat_heatmap=zeros,
    )


# ---------------------------------------------------------------------------
# 5×5 Chebyshev box filter helper (for threat heatmap)
# ---------------------------------------------------------------------------

def _box_filter_5x5(x: jnp.ndarray) -> jnp.ndarray:
    """Sum over 5×5 Chebyshev neighborhood (radius 2).

    Reuses the stacked-view pattern from _get_visibility in game.py,
    extended to a 5×5 window (25 views).
    """
    H, W = x.shape
    padded = jnp.pad(x, 2, mode="constant", constant_values=0)
    # Stack all 25 positions in a 5×5 window
    stacked = jnp.stack([
        padded[i:H + i, j:W + j]
        for i in range(5) for j in range(5)
    ], axis=0)
    return jnp.sum(stacked, axis=0)


# ---------------------------------------------------------------------------
# update_memory
# ---------------------------------------------------------------------------

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
        Updated MemoryState with all 15 channels.
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
    new_enemy_gen = jnp.maximum(memory.enemy_gen_discovered,
                                enemy_gen_visible.astype(jnp.float32))

    # 2: cities_discovered — where cities were revealed (visible cities)
    city_visible = city & ~fog
    new_cities = jnp.maximum(memory.cities_discovered,
                             city_visible.astype(jnp.float32))

    # 3: opponent_territory — snapshot of currently visible opponent cells
    new_opp_territory = opponent.astype(jnp.float32)

    # 4-10: self move history — shift register, 7 most recent moves
    is_pass = action[0]
    row, col = action[1], action[2]
    move_source = jnp.zeros((H, W), dtype=jnp.float32)
    move_source = move_source.at[row, col].set(1.0 - is_pass.astype(jnp.float32))

    new_move_0 = move_source
    new_move_1 = memory.self_move_0
    new_move_2 = memory.self_move_1
    new_move_3 = memory.self_move_2
    new_move_4 = memory.self_move_3
    new_move_5 = memory.self_move_4
    new_move_6 = memory.self_move_5

    # 11: opponent_explored — cells opponent has seen (paper item 3)
    #      Computed as 3×3 Chebyshev around visible opponent cells, monotonic.
    opp_visibility = compute_visibility(opponent)
    new_opponent_explored = jnp.maximum(
        memory.opponent_explored, opp_visibility.astype(jnp.float32),
    )

    # 12: bfs_dist_enemy_gen — BFS distance to known enemy general
    has_enemy_gen = jnp.any(new_enemy_gen > 0.5)
    enemy_gen_sources = new_enemy_gen > 0.5
    passable = ~mtn
    new_bfs_enemy = lax.cond(
        has_enemy_gen,
        lambda: compute_bfs_distance(passable, enemy_gen_sources),
        lambda: jnp.ones((H, W), dtype=jnp.float32),  # unknown
    )

    # 13: bfs_dist_city — BFS distance to nearest known city (multi-source)
    has_cities = jnp.any(new_cities > 0.5)
    city_sources = new_cities > 0.5
    new_bfs_city = lax.cond(
        has_cities,
        lambda: compute_bfs_distance(passable, city_sources),
        lambda: jnp.ones((H, W), dtype=jnp.float32),  # unknown
    )

    # 14: threat_heatmap — enemy army density in 5×5 Chebyshev radius
    enemy_army = opponent.astype(jnp.float32) * obs.armies.astype(jnp.float32)
    threat_sum = _box_filter_5x5(enemy_army)
    max_threat = jnp.maximum(jnp.float32(1.0), threat_sum.max())
    new_threat = threat_sum / max_threat

    return MemoryState(
        explored=new_explored,
        enemy_gen_discovered=new_enemy_gen,
        cities_discovered=new_cities,
        opponent_territory=new_opp_territory,
        self_move_0=new_move_0,
        self_move_1=new_move_1,
        self_move_2=new_move_2,
        self_move_3=new_move_3,
        self_move_4=new_move_4,
        self_move_5=new_move_5,
        self_move_6=new_move_6,
        opponent_explored=new_opponent_explored,
        bfs_dist_enemy_gen=new_bfs_enemy,
        bfs_dist_city=new_bfs_city,
        threat_heatmap=new_threat,
    )


# ---------------------------------------------------------------------------
# memory_to_channels
# ---------------------------------------------------------------------------

def memory_to_channels(memory: MemoryState) -> jnp.ndarray:
    """
    Stack memory channels into a (NUM_MEMORY_CHANNELS, H, W) tensor for network input.

    Args:
        memory: MemoryState to convert.

    Returns:
        Float32 array of shape (NUM_MEMORY_CHANNELS, H, W).
    """
    return jnp.stack([
        memory.explored,
        memory.enemy_gen_discovered,
        memory.cities_discovered,
        memory.opponent_territory,
        memory.self_move_0,
        memory.self_move_1,
        memory.self_move_2,
        memory.self_move_3,
        memory.self_move_4,
        memory.self_move_5,
        memory.self_move_6,
        memory.opponent_explored,
        memory.bfs_dist_enemy_gen,
        memory.bfs_dist_city,
        memory.threat_heatmap,
    ], axis=0).astype(jnp.float32)


# ---------------------------------------------------------------------------
# reset_memory_on_done
# ---------------------------------------------------------------------------

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
