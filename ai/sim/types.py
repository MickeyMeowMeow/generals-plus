"""
Core data types for the JAX game simulator.

Matches generals-plus TypeScript engine semantics.
"""

from typing import NamedTuple

import jax.numpy as jnp


class GameState(NamedTuple):
    """
    Immutable game state for 1v1 Generals Plus.

    Attributes:
        armies: (H, W) int32 — army counts per cell.
        ownership: (2, H, W) bool — ownership[i] is player i's cells.
        ownership_neutral: (H, W) bool — neutral (unowned passable) cells.
        generals: (H, W) bool — general positions (updated on capture: becomes False).
        cities: (H, W) bool — city positions (updated on general capture: becomes True).
        mountains: (H, W) bool — mountain positions (impassable).
        passable: (H, W) bool — cells that are not mountains.
        general_positions: (2, 2) int32 — [row, col] for each player's general.
        time: scalar int32 — current game tick.
        winner: scalar int32 — -1 if ongoing, 0 or 1 for winner.
        pool_idx: scalar int32 — index into state pool for auto-reset.
    """

    armies: jnp.ndarray
    ownership: jnp.ndarray
    ownership_neutral: jnp.ndarray
    generals: jnp.ndarray
    cities: jnp.ndarray
    mountains: jnp.ndarray
    passable: jnp.ndarray
    general_positions: jnp.ndarray
    time: jnp.ndarray
    winner: jnp.ndarray
    pool_idx: jnp.ndarray


class GameInfo(NamedTuple):
    """
    Game statistics returned after each step.

    Attributes:
        army: (2,) int32 — total army counts per player.
        land: (2,) int32 — total land counts per player.
        is_done: bool — True if game has ended.
        winner: int32 — -1 if ongoing, 0 or 1 for winner.
        time: int32 — current game tick.
    """

    army: jnp.ndarray
    land: jnp.ndarray
    is_done: jnp.ndarray
    winner: jnp.ndarray
    time: jnp.ndarray


class Observation(NamedTuple):
    """
    Player observation with fog of war applied.

    All spatial fields have shape (H, W). Boolean masks use True for presence.

    Attributes:
        armies: Army counts in visible cells (0 in fog).
        generals: Visible general positions.
        cities: Visible city positions.
        mountains: Visible mountain positions.
        neutral_cells: Visible neutral (unowned) cells.
        owned_cells: Cells owned by the observing player.
        opponent_cells: Visible opponent cells.
        fog_cells: Hidden cells that are not mountains/cities.
        structures_in_fog: Hidden cells that are mountains/cities.
        owned_land_count: Scalar — total cells owned by this player.
        owned_army_count: Scalar — total army across owned cells.
        opponent_land_count: Scalar — opponent's total cell count.
        opponent_army_count: Scalar — opponent's total army count.
        timestep: Scalar — current game tick.
    """

    armies: jnp.ndarray
    generals: jnp.ndarray
    cities: jnp.ndarray
    mountains: jnp.ndarray
    neutral_cells: jnp.ndarray
    owned_cells: jnp.ndarray
    opponent_cells: jnp.ndarray
    fog_cells: jnp.ndarray
    structures_in_fog: jnp.ndarray
    owned_land_count: jnp.ndarray
    owned_army_count: jnp.ndarray
    opponent_land_count: jnp.ndarray
    opponent_army_count: jnp.ndarray
    timestep: jnp.ndarray
