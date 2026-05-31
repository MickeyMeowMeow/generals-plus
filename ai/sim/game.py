"""
JAX game logic for Generals Plus 1v1.

Matches the generals-plus TypeScript engine rules:
  - Army increment: structures (general/city) +1 every 2 ticks, all owned +1 every 50 ticks
  - Combat: move all-but-1 (or half for split), reinforce own, attack enemy/neutral
  - General capture: captured general → city, loser cells → winner
  - Vision: 3x3 Chebyshev radius around owned cells

All functions are jit-compiled for vectorized training.
"""

import jax
import jax.numpy as jnp
from jax import lax

from .action import DIRECTIONS
from .types import GameState, GameInfo, Observation


# ---------------------------------------------------------------------------
# Initial state creation
# ---------------------------------------------------------------------------

def create_initial_state(grid: jnp.ndarray) -> GameState:
    """
    Create initial GameState from a numeric grid.

    Grid values:
        -2: Mountain (impassable)
         0: Empty passable cell
         1: Player 0's general
         2: Player 1's general
      40-50: City with that army value

    Returns GameState ready for gameplay.
    """
    H, W = grid.shape

    is_general_0 = grid == 1
    is_general_1 = grid == 2
    generals = is_general_0 | is_general_1

    mountains = grid == -2
    passable = ~mountains
    cities = grid > 2

    # Each player starts owning their general cell
    ownership = jnp.stack([is_general_0, is_general_1])
    ownership_neutral = passable & ~is_general_0 & ~is_general_1

    # Army: generals start with 1, cities with their grid value
    armies = jnp.where(is_general_0 | is_general_1, 1, 0).astype(jnp.int32)
    armies = jnp.where(cities, grid, armies)

    # Record general positions (original, for observation)
    gen_pos_0 = jnp.argwhere(is_general_0, size=1, fill_value=-1)[0]
    gen_pos_1 = jnp.argwhere(is_general_1, size=1, fill_value=-1)[0]
    general_positions = jnp.stack([gen_pos_0, gen_pos_1])

    return GameState(
        armies=armies,
        ownership=ownership,
        ownership_neutral=ownership_neutral,
        generals=generals,
        cities=cities,
        mountains=mountains,
        passable=passable,
        general_positions=general_positions,
        time=jnp.int32(0),
        winner=jnp.int32(-1),
        pool_idx=jnp.int32(0),
    )


# ---------------------------------------------------------------------------
# Army increment (matches TS engine)
# ---------------------------------------------------------------------------

@jax.jit
def _army_increment(state: GameState) -> GameState:
    """
    Increment armies matching original generals.io rules:
      - All owned cells (including structures): +1 every 50 ticks
      - Owned structures (generals + cities):   +1 every 2 ticks (even ticks)
    """
    time = state.time
    armies = state.armies

    # All owned cells get +1 every 50 ticks
    increment_all = time % 50 == 0
    all_owned = state.ownership[0] | state.ownership[1]
    armies = lax.cond(
        increment_all,
        lambda a: a + all_owned.astype(jnp.int32),
        lambda a: a,
        armies,
    )

    # Owned structures get +1 every 2 ticks (on even ticks, matching TS engine)
    increment_structures = time % 2 == 0
    structures = state.generals | state.cities
    owned_structures = structures & all_owned
    armies = lax.cond(
        increment_structures,
        lambda a: a + owned_structures.astype(jnp.int32),
        lambda a: a,
        armies,
    )

    return state._replace(armies=armies)


# ---------------------------------------------------------------------------
# Action execution (matches TS BaseCombatResolver)
# ---------------------------------------------------------------------------

@jax.jit
def _execute_move(
    state: GameState, player_idx: int,
    si: int, sj: int, direction: int, split_army: int,
) -> GameState:
    """Execute a single move for one player. Matches TS combat rules."""
    H, W = state.armies.shape

    # Validate source
    in_bounds = (si >= 0) & (si < H) & (sj >= 0) & (sj < W)
    owns_source = state.ownership[player_idx, si, sj]
    source_army = state.armies[si, sj]
    can_move = owns_source & (source_army > 1)

    # Compute destination
    di = si + DIRECTIONS[direction, 0]
    dj = sj + DIRECTIONS[direction, 1]
    dest_in_bounds = (di >= 0) & (di < H) & (dj >= 0) & (dj < W)
    dest_passable = dest_in_bounds & state.passable[di, dj]

    # Troops to move: all-but-1 or half for split
    army_to_move = lax.cond(
        split_army == 1,
        lambda a: a // 2,
        lambda a: a - 1,
        source_army,
    )
    army_to_move = jnp.maximum(0, jnp.minimum(army_to_move, source_army - 1))

    valid_move = in_bounds & dest_in_bounds & can_move & dest_passable & (army_to_move > 0)

    def apply(s: GameState) -> GameState:
        return _apply_move(s, player_idx, si, sj, di, dj, army_to_move)

    return lax.cond(valid_move, apply, lambda s: s, state)


@jax.jit
def _apply_move(
    state: GameState, player_idx: int,
    si: int, sj: int, di: int, dj: int, army_to_move: int,
) -> GameState:
    """Apply a validated move to the game state. Matches TS combat rules."""
    armies = state.armies
    ownership = state.ownership
    ownership_neutral = state.ownership_neutral

    # Determine target affiliation
    target_is_p0 = ownership[0, di, dj]
    target_is_p1 = ownership[1, di, dj]
    target_is_neutral = ownership_neutral[di, dj]
    moving_to_own = (player_idx == 0) & target_is_p0 | (player_idx == 1) & target_is_p1
    moving_to_enemy = ~moving_to_own & ~target_is_neutral

    target_army = armies[di, dj]

    # --- Case 1: Moving to own cell (reinforce) ---
    armies_reinf = armies.at[di, dj].add(army_to_move)
    armies_reinf = armies_reinf.at[si, sj].add(-army_to_move)

    # --- Case 2: Attack enemy/neutral ---
    attacker_wins = army_to_move > target_army
    tie = army_to_move == target_army

    # Attacker wins: capture, remaining = moving - target
    armies_win = armies.at[di, dj].set(army_to_move - target_army)
    armies_win = armies_win.at[si, sj].add(-army_to_move)

    # Tie: both depleted, defender keeps ownership
    armies_tie = armies.at[di, dj].set(0)
    armies_tie = armies_tie.at[si, sj].add(-army_to_move)

    # Attacker loses: defender keeps, remaining = target - moving
    armies_lose = armies.at[di, dj].set(target_army - army_to_move)
    armies_lose = armies_lose.at[si, sj].add(-army_to_move)

    armies_attack = lax.cond(
        attacker_wins,
        lambda: armies_win,
        lambda: lax.cond(tie, lambda: armies_tie, lambda: armies_lose),
    )

    # Ownership updates on win or tie-to-neutral
    # On win: attacker takes ownership
    ownership_attack = ownership
    ownership_neutral_attack = ownership_neutral

    # Attacker wins → set attacker's ownership bit, clear opponent's/neutral's
    ownership_attack = lax.cond(
        attacker_wins,
        lambda o: o.at[player_idx, di, dj].set(True),
        lambda o: o,
        ownership_attack,
    )
    # If winning against opponent cell, clear opponent's ownership
    ownership_attack = lax.cond(
        attacker_wins & target_is_p1 & (player_idx == 0),
        lambda o: o.at[1, di, dj].set(False),
        lambda o: o,
        ownership_attack,
    )
    ownership_attack = lax.cond(
        attacker_wins & target_is_p0 & (player_idx == 1),
        lambda o: o.at[0, di, dj].set(False),
        lambda o: o,
        ownership_attack,
    )
    # If winning against neutral, clear neutral flag
    ownership_neutral_attack = lax.cond(
        attacker_wins & target_is_neutral,
        lambda o: o.at[di, dj].set(False),
        lambda o: o,
        ownership_neutral_attack,
    )

    # Select between reinforce and attack
    armies = lax.cond(moving_to_own, lambda: armies_reinf, lambda: armies_attack)
    ownership = lax.cond(moving_to_own, lambda: ownership, lambda: ownership_attack)
    ownership_neutral = lax.cond(
        moving_to_own, lambda: ownership_neutral, lambda: ownership_neutral_attack,
    )

    # --- General capture (TS rule: general → city, loser cells → winner) ---
    is_enemy_general = state.generals[di, dj] & (
        (player_idx == 0) & target_is_p1 | (player_idx == 1) & target_is_p0
    )
    general_captured = attacker_wins & is_enemy_general

    # On general capture: change general to city, transfer loser cells to winner
    loser_idx = 1 - player_idx

    new_generals = lax.cond(
        general_captured,
        lambda g: g.at[di, dj].set(False),
        lambda g: g,
        state.generals,
    )
    new_cities = lax.cond(
        general_captured,
        lambda c: c.at[di, dj].set(True),
        lambda c: c,
        state.cities,
    )

    # Transfer all loser cells to winner
    ownership = lax.cond(
        general_captured,
        lambda o: o.at[player_idx].set(o[player_idx] | o[loser_idx]),
        lambda o: o,
        ownership,
    )
    ownership = lax.cond(
        general_captured,
        lambda o: o.at[loser_idx].set(jnp.zeros_like(o[loser_idx], dtype=bool)),
        lambda o: o,
        ownership,
    )
    ownership_neutral = lax.cond(
        general_captured,
        lambda o: o & ~state.ownership[loser_idx],
        lambda o: o,
        ownership_neutral,
    )

    winner = lax.cond(general_captured, lambda: jnp.int32(player_idx), lambda: state.winner)

    return state._replace(
        armies=armies,
        ownership=ownership,
        ownership_neutral=ownership_neutral,
        generals=new_generals,
        cities=new_cities,
        winner=winner,
    )


# ---------------------------------------------------------------------------
# Move order (original generals.io rules)
# ---------------------------------------------------------------------------

@jax.jit
def _determine_move_order(state: GameState, actions: jnp.ndarray) -> jnp.ndarray:
    """Determine which player moves first (original generals.io rules).

    Priority: chasing > reinforcing > bigger army > P0 first.
    Returns 0 or 1.
    """
    pass_0, row_0, col_0, dir_0, _ = actions[0]
    pass_1, row_1, col_1, dir_1, _ = actions[1]

    # Only P0 passes → P1 goes first
    only_p0_passes = (pass_0 == 1) & (pass_1 == 0)

    # Destination coords
    di_0 = row_0 + DIRECTIONS[dir_0, 0]
    dj_0 = col_0 + DIRECTIONS[dir_0, 1]
    di_1 = row_1 + DIRECTIONS[dir_1, 0]
    dj_1 = col_1 + DIRECTIONS[dir_1, 1]

    # Chasing: P0 moves to P1's source or vice versa
    p0_chasing = (di_0 == row_1) & (dj_0 == col_1)
    p1_chasing = (di_1 == row_0) & (dj_1 == col_0)

    # Reinforcing: moving to own cell
    p0_reinforcing = state.ownership[0, di_0, dj_0]
    p1_reinforcing = state.ownership[1, di_1, dj_1]

    # Army comparison at source cells
    army_0 = state.armies[row_0, col_0]
    army_1 = state.armies[row_1, col_1]

    # P1 goes first if:
    p1_wins_by_chase = p1_chasing & ~p0_chasing
    tie_on_chase = p0_chasing == p1_chasing
    p1_wins_by_reinforce = tie_on_chase & p1_reinforcing & ~p0_reinforcing
    tie_on_reinforce = p0_reinforcing == p1_reinforcing
    p1_wins_by_army = tie_on_chase & tie_on_reinforce & (army_1 > army_0)

    p1_goes_first = p1_wins_by_chase | p1_wins_by_reinforce | p1_wins_by_army | only_p0_passes

    return lax.cond(p1_goes_first, lambda: jnp.int32(1), lambda: jnp.int32(0))


# ---------------------------------------------------------------------------
# Main step
# ---------------------------------------------------------------------------

@jax.jit
def step(state: GameState, actions: jnp.ndarray) -> tuple[GameState, GameInfo]:
    """
    Execute one game tick with actions from both players.

    Move order follows original generals.io rules:
      - If one player passes, the other goes first
      - If P0 is chasing P1 (moving to P1's source) and P1 is not: P1 goes first
      - If chasing is tied, the reinforcing player goes first
      - If still tied, the player with more troops on the source goes first
      - Otherwise P0 goes first

    Args:
        state: Current GameState.
        actions: (2, 5) array, each row is [pass, row, col, direction, split].

    Returns:
        (new_state, game_info)
    """
    done_before = state.winner >= 0

    # Determine move order (original generals.io rules)
    first_player = _determine_move_order(state, actions)
    second_player = 1 - first_player

    # Execute first player's action (skip if pass)
    state = lax.cond(
        actions[first_player][0] == 1,
        lambda s: s,
        lambda s: _execute_move(
            s, first_player,
            actions[first_player][1], actions[first_player][2],
            actions[first_player][3], actions[first_player][4],
        ),
        state,
    )

    # Execute second player's action (skip if pass)
    state = lax.cond(
        actions[second_player][0] == 1,
        lambda s: s,
        lambda s: _execute_move(
            s, second_player,
            actions[second_player][1], actions[second_player][2],
            actions[second_player][3], actions[second_player][4],
        ),
        state,
    )

    # Advance time (unless game was already over)
    state = lax.cond(
        done_before,
        lambda s: s,
        lambda s: s._replace(time=s.time + 1),
        state,
    )

    # If game just ended (general captured): transfer loser cells, skip army increment
    # If game ongoing: do army increment
    state = lax.cond(
        state.winner >= 0,
        lambda s: _transfer_loser_cells(s),
        lambda s: _army_increment(s),
        state,
    )

    return state, get_info(state)


def _transfer_loser_cells(state: GameState) -> GameState:
    """After general capture, ensure all loser cells are transferred to winner."""
    winner_idx = state.winner
    loser_idx = 1 - winner_idx

    new_ownership = state.ownership.at[winner_idx].set(
        state.ownership[winner_idx] | state.ownership[loser_idx]
    )
    new_ownership = new_ownership.at[loser_idx].set(
        jnp.zeros_like(state.ownership[loser_idx], dtype=bool)
    )
    new_neutral = state.ownership_neutral & ~state.ownership[loser_idx]

    return state._replace(ownership=new_ownership, ownership_neutral=new_neutral)


# ---------------------------------------------------------------------------
# Game info
# ---------------------------------------------------------------------------

@jax.jit
def get_info(state: GameState) -> GameInfo:
    """Compute game statistics from state."""
    armies = state.armies
    ownership = state.ownership

    return GameInfo(
        army=jnp.stack([
            jnp.sum(armies * ownership[0]),
            jnp.sum(armies * ownership[1]),
        ]),
        land=jnp.stack([
            jnp.sum(ownership[0]),
            jnp.sum(ownership[1]),
        ]),
        is_done=state.winner >= 0,
        winner=state.winner,
        time=state.time,
    )


# ---------------------------------------------------------------------------
# Observation with fog of war
# ---------------------------------------------------------------------------

@jax.jit
def compute_visibility(ownership: jnp.ndarray) -> jnp.ndarray:
    """Compute visibility mask (3x3 Chebyshev radius around owned cells).

    Public alias for _get_visibility — used by memory.py for opponent_explored channel.
    """
    return _get_visibility(ownership)


@jax.jit
def _get_visibility(ownership: jnp.ndarray) -> jnp.ndarray:
    """Compute visibility mask (3x3 Chebyshev radius around owned cells)."""
    H, W = ownership.shape
    ownership_float = ownership.astype(jnp.float32)
    padded = jnp.pad(ownership_float, 1, mode="constant", constant_values=0)

    # 3x3 kernel: all 9 neighbors
    stacked = jnp.stack([
        padded[0:H, 0:W], padded[0:H, 1:W+1], padded[0:H, 2:W+2],
        padded[1:H+1, 0:W], padded[1:H+1, 1:W+1], padded[1:H+1, 2:W+2],
        padded[2:H+2, 0:W], padded[2:H+2, 1:W+1], padded[2:H+2, 2:W+2],
    ], axis=0)

    return jnp.max(stacked, axis=0) > 0


# ---------------------------------------------------------------------------
# BFS distance field
# ---------------------------------------------------------------------------

@jax.jit
def compute_bfs_distance(
    passable: jnp.ndarray,
    sources: jnp.ndarray,
) -> jnp.ndarray:
    """Compute normalized BFS distance from source cells to all passable cells.

    Uses iterative 4-direction dilation (jnp.roll pattern) for JAX compatibility.
    Distances are normalized by max(H, W) → range [0, 1].

    Args:
        passable: (H, W) bool — traversable cells (False = blocked).
        sources:  (H, W) bool — one or more source positions.

    Returns:
        (H, W) float32 — 0.0 at sources, increasing outward to 1.0 at max distance.
    """
    H, W = passable.shape
    max_dist = jnp.float32(max(H, W))

    # Initialize: 0 at sources, max_dist elsewhere
    dist = jnp.where(sources, jnp.float32(0.0), max_dist)
    # Track which cells have been reached
    reached = sources

    def cond(state):
        dist_arr, reached_arr, changed = state
        return changed & ~jnp.all(reached_arr)

    def body(state):
        dist_arr, reached_arr, _ = state
        # Dilate reached front in 4 directions
        up = jnp.roll(reached_arr, -1, axis=0).at[-1, :].set(False)
        down = jnp.roll(reached_arr, 1, axis=0).at[0, :].set(False)
        left = jnp.roll(reached_arr, -1, axis=1).at[:, -1].set(False)
        right = jnp.roll(reached_arr, 1, axis=1).at[:, 0].set(False)

        new_reached = (reached_arr | up | down | left | right) & passable
        newly_reached = new_reached & ~reached_arr

        # Assign distance: current front distance + 1
        front_dist = jnp.where(reached_arr, dist_arr, max_dist)
        front_dist_min = front_dist.min()
        new_dist = jnp.where(newly_reached, front_dist_min + jnp.float32(1.0), dist_arr)

        changed = jnp.any(newly_reached)
        return new_dist, new_reached, changed

    dist, _, _ = jax.lax.while_loop(cond, body, (dist, reached, jnp.bool_(True)))

    # Normalize to [0, 1]
    return jnp.clip(dist / max_dist, 0.0, 1.0)


@jax.jit
def get_observation(state: GameState, player_idx: int) -> Observation:
    """Get a player's observation with fog of war."""
    visible = _get_visibility(state.ownership[player_idx])
    invisible = ~visible

    opponent_idx = 1 - player_idx
    info = get_info(state)

    return Observation(
        armies=state.armies * visible,
        generals=state.generals * visible,
        cities=state.cities * visible,
        mountains=state.mountains * visible,
        neutral_cells=state.ownership_neutral * visible,
        owned_cells=state.ownership[player_idx] * visible,
        opponent_cells=state.ownership[opponent_idx] * visible,
        fog_cells=invisible & ~(state.mountains | state.cities),
        structures_in_fog=invisible & (state.mountains | state.cities),
        owned_land_count=info.land[player_idx],
        owned_army_count=info.army[player_idx],
        opponent_land_count=info.land[opponent_idx],
        opponent_army_count=info.army[opponent_idx],
        timestep=state.time,
    )
