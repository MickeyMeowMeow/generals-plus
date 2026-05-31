"""
Grid generation for Generals Plus training.

Generates square grids with generals, mountains, cities, and connectivity guarantees.
Uses JAX-compatible operations (Gumbel-max sampling, scan loops) for vectorization.

Matches generals-plus TS engine placement constraints:
  - Generals placed first with min distance constraint
  - Mountains via density-controlled sampling
  - Cities placed with castle values (40-50)
  - Connectivity guaranteed via L-path carving if needed
"""

from functools import partial

import jax
from jax import lax
import jax.numpy as jnp


@partial(jax.jit, static_argnames=[
    'grid_dims', 'pad_to', 'mountain_density_range',
    'num_cities_range', 'min_generals_distance', 'castle_val_range',
])
def generate_grid(
    key: jax.random.PRNGKey,
    grid_dims: tuple[int, int] = (23, 23),
    pad_to: int | None = None,
    mountain_density_range: tuple[float, float] = (0.15, 0.25),
    num_cities_range: tuple[int, int] = (4, 8),
    min_generals_distance: int = 0,
    castle_val_range: tuple[int, int] = (40, 51),
) -> jnp.ndarray:
    """
    Generate a playable grid for 1v1 training.

    Args:
        key: JAX random key.
        grid_dims: (height, width) of the playable area.
        pad_to: Pad grid to this size for batching (default: max(h, w) + 1).
        mountain_density_range: (min, max) fraction of cells that are mountains.
        num_cities_range: (min, max) number of cities.
        min_generals_distance: Minimum Manhattan distance between generals.
            If <= 0, auto-computed as max(8, int(0.6 * min(h, w))) matching
            the TS engine's minGeneralDistanceFactor=0.6 (paper: BFS ≥ 15).
        castle_val_range: (min, max) army value for cities.

    Returns:
        2D int32 array: -2=mountain, 0=empty, 1=P0 general, 2=P1 general, 40-50=city.
    """
    keys = jax.random.split(key, 10)

    h, w = grid_dims

    # Auto-compute general distance following TS engine: min(w,h) * 0.6
    # with floor of 8 (paper requires BFS >= 15 for full-size grids)
    if min_generals_distance <= 0:
        min_generals_distance = max(8, int(0.6 * min(h, w)))
    num_tiles = h * w

    # Number of cities and mountains
    num_cities = jax.random.randint(keys[0], (), num_cities_range[0], num_cities_range[1] + 1)
    min_mt = int(mountain_density_range[0] * num_tiles)
    max_mt = int(mountain_density_range[1] * num_tiles)
    num_mountains = jax.random.randint(keys[1], (), min_mt, max_mt + 1)

    # Start with empty grid
    grid = jnp.full(grid_dims, 0, dtype=jnp.int32)

    # --- Step 1: Place generals ---
    pos_a, pos_b = _place_generals(keys[2], keys[3], grid_dims, min_generals_distance)
    grid = grid.at[pos_a].set(1)
    grid = grid.at[pos_b].set(2)

    # --- Step 2: Place mountains ---
    grid = _place_mountains(keys[4], grid, num_mountains)

    # --- Step 3: Place cities ---
    castle_val_a = jax.random.randint(keys[5], (), castle_val_range[0], castle_val_range[1])
    castle_val_b = jax.random.randint(keys[6], (), castle_val_range[0], castle_val_range[1])
    grid = _place_castles_near_generals(keys[7], grid, pos_a, pos_b, castle_val_a, castle_val_b)

    remaining_cities = num_cities - 2
    city_vals = jax.random.randint(keys[8], (20,), castle_val_range[0], castle_val_range[1])
    grid = _place_remaining_cities(keys[9], grid, remaining_cities, city_vals)

    # --- Step 4: Ensure connectivity ---
    connected = _check_connectivity(grid, pos_a, pos_b)
    grid = lax.cond(connected, lambda g: g, lambda g: _carve_l_path(g, pos_a, pos_b), grid)

    # --- Step 5: Padding ---
    if pad_to is None:
        pad_to = max(h, w) + 1

    pad_h = max(0, pad_to - h)
    pad_w = max(0, pad_to - w)
    if pad_h > 0 or pad_w > 0:
        grid = jnp.pad(grid, ((0, pad_h), (0, pad_w)),
                       mode='constant', constant_values=-2)

    return grid


# ---------------------------------------------------------------------------
# General placement
# ---------------------------------------------------------------------------

def _place_generals(
    key_a: jnp.ndarray, key_b: jnp.ndarray,
    grid_dims: tuple[int, int], min_distance: int,
) -> tuple[tuple[int, int], tuple[int, int]]:
    """Place two generals with minimum Manhattan distance constraint."""
    h, w = grid_dims

    # First general: random interior position
    pos_a = (_sample_interior(key_a, h, w, margin=1))

    # Second general: must be at least min_distance from first
    dist_from_a = _manhattan_distances(pos_a, h, w)
    valid_b = dist_from_a >= min_distance
    pos_b = _sample_from_mask(key_b, valid_b)

    return pos_a, pos_b


def _sample_interior(key: jnp.ndarray, h: int, w: int, margin: int = 1) -> tuple[int, int]:
    """Sample a random interior position (not on edge)."""
    row = jax.random.randint(key, (), margin, h - margin)
    _, subkey = jax.random.split(key)
    col = jax.random.randint(subkey, (), margin, w - margin)
    return (row, col)


def _manhattan_distances(pos: tuple[int, int], h: int, w: int) -> jnp.ndarray:
    """Manhattan distance from pos to every cell."""
    i_idx = jnp.arange(h)[:, None]
    j_idx = jnp.arange(w)[None, :]
    return jnp.abs(i_idx - pos[0]) + jnp.abs(j_idx - pos[1])


# ---------------------------------------------------------------------------
# Mountain placement
# ---------------------------------------------------------------------------

def _place_mountains(key: jnp.ndarray, grid: jnp.ndarray, num_mountains: int) -> jnp.ndarray:
    """Place mountains on empty cells using Gumbel-max sampling."""
    h, w = grid.shape
    flat_grid = grid.reshape(-1)

    empty = flat_grid == 0
    logits = jnp.where(empty, 0.0, -jnp.inf)
    gumbel = jax.random.gumbel(key, shape=logits.shape)
    scores = logits + gumbel

    # Pick top num_mountains
    max_possible = h * w
    _, indices = jax.lax.top_k(scores, max_possible)
    mask = jnp.arange(max_possible) < num_mountains

    def place_one(flat, idx_mask):
        idx, should = idx_mask
        return jnp.where(should & (flat[idx] == 0), flat.at[idx].set(-2), flat), None

    flat_grid, _ = jax.lax.scan(place_one, flat_grid, (indices, mask))
    return flat_grid.reshape(h, w)


# ---------------------------------------------------------------------------
# City placement
# ---------------------------------------------------------------------------

def _place_castles_near_generals(
    key: jnp.ndarray, grid: jnp.ndarray,
    pos_a: tuple[int, int], pos_b: tuple[int, int],
    val_a: int, val_b: int,
) -> jnp.ndarray:
    """Place one castle near each general (within BFS distance ~4)."""
    h, w = grid.shape

    # Near A
    near_a = _bfs_reachable_within(grid, pos_a, 4)
    candidates_a = near_a & (grid == 0)
    pos_ca = _sample_from_mask_or_fallback(key, candidates_a, near_a, grid)
    k2, k3 = jax.random.split(jax.random.PRNGKey(0))  # dummy split
    # Use a different key region
    subkey = jax.random.fold_in(key, 1)
    pos_ca = _sample_from_mask_or_fallback(subkey, candidates_a, near_a, grid)
    grid = grid.at[pos_ca].set(val_a)

    # Near B (avoid castle A position)
    near_b = _bfs_reachable_within(grid, pos_b, 4)
    candidates_b = near_b & (grid == 0)
    subkey2 = jax.random.fold_in(key, 2)
    pos_cb = _sample_from_mask_or_fallback(subkey2, candidates_b, near_b, grid)
    grid = grid.at[pos_cb].set(val_b)

    return grid


def _place_remaining_cities(
    key: jnp.ndarray, grid: jnp.ndarray, num_cities: int, city_vals: jnp.ndarray,
) -> jnp.ndarray:
    """Place remaining cities on empty cells."""
    h, w = grid.shape
    flat = grid.reshape(-1)

    empty = flat == 0
    logits = jnp.where(empty, 0.0, -jnp.inf)
    gumbel = jax.random.gumbel(key, shape=logits.shape)
    scores = logits + gumbel

    max_cities = 20
    _, indices = jax.lax.top_k(scores, max_cities)
    mask = (jnp.arange(max_cities) < num_cities) & (jnp.arange(max_cities) < len(city_vals))

    def place_one(flat, args):
        idx, val, should = args
        return jnp.where(should & (flat[idx] == 0), flat.at[idx].set(val), flat), None

    flat, _ = jax.lax.scan(place_one, flat, (indices, city_vals, mask))
    return flat.reshape(h, w)


# ---------------------------------------------------------------------------
# Connectivity
# ---------------------------------------------------------------------------

def _check_connectivity(
    grid: jnp.ndarray, pos_a: tuple[int, int], pos_b: tuple[int, int],
) -> bool:
    """Check if pos_a can reach pos_b via BFS (through non-mountain, non-city cells)."""
    h, w = grid.shape
    # Passable for connectivity: not mountain, not city (generals are passable)
    passable = (grid >= 0) & (grid <= 2)

    reached = jnp.zeros((h, w), dtype=bool)
    reached = reached.at[pos_a].set(True)

    def dilate(r):
        up = jnp.roll(r, -1, axis=0).at[-1, :].set(False)
        down = jnp.roll(r, 1, axis=0).at[0, :].set(False)
        left = jnp.roll(r, -1, axis=1).at[:, -1].set(False)
        right = jnp.roll(r, 1, axis=1).at[:, 0].set(False)
        return (r | up | down | left | right) & passable

    def cond(state):
        r, prev, _ = state
        return ~r[pos_b] & jnp.any(r != prev)

    def body(state):
        r, _, step = state
        return (dilate(r), r, step + 1)

    first = dilate(reached)
    final, _, _ = jax.lax.while_loop(cond, body, (first, reached, jnp.int32(1)))

    return final[pos_b]


def _carve_l_path(
    grid: jnp.ndarray, pos_a: tuple[int, int], pos_b: tuple[int, int],
) -> jnp.ndarray:
    """Carve L-shaped path between two positions, clearing mountains/cities."""
    h, w = grid.shape
    i1, j1 = pos_a
    i2, j2 = pos_b

    i_idx = jnp.arange(h)[:, None]
    j_idx = jnp.arange(w)[None, :]

    h_mask = (i_idx == i1) & (j_idx >= jnp.minimum(j1, j2)) & (j_idx <= jnp.maximum(j1, j2))
    v_mask = (j_idx == j2) & (i_idx >= jnp.minimum(i1, i2)) & (i_idx <= jnp.maximum(i1, i2))
    path = h_mask | v_mask

    # Clear obstacles on path but preserve generals (1, 2)
    obstacle = (grid == -2) | (grid > 2)
    return jnp.where(path & obstacle, 0, grid)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _sample_from_mask(key: jnp.ndarray, mask: jnp.ndarray) -> tuple[int, int]:
    """Sample one index from a boolean mask using Gumbel-max trick."""
    flat = mask.reshape(-1).astype(jnp.float32)
    logits = jnp.where(flat > 0, 0.0, -jnp.inf)
    gumbel = jax.random.gumbel(key, shape=logits.shape)
    idx = jnp.argmax(logits + gumbel)
    return jnp.unravel_index(idx, mask.shape)


def _sample_from_mask_or_fallback(
    key: jnp.ndarray, mask: jnp.ndarray, fallback_mask: jnp.ndarray, grid: jnp.ndarray,
) -> tuple[int, int]:
    """Sample from mask if non-empty, otherwise from fallback (after clearing obstacles)."""
    has_candidates = jnp.any(mask)
    # If fallback is needed, clear obstacles in fallback area
    fallback = fallback_mask & (grid == -2)
    effective = jnp.where(has_candidates, mask, fallback)
    return _sample_from_mask(key, effective)


def _bfs_reachable_within(
    grid: jnp.ndarray, start: tuple[int, int], k: int,
) -> jnp.ndarray:
    """BFS flood fill from start for k steps. Returns mask of reachable cells (excluding start)."""
    h, w = grid.shape
    passable = grid != -2

    reachable = jnp.zeros((h, w), dtype=bool)
    reachable = reachable.at[start].set(True)

    def dilate(r):
        up = jnp.roll(r, -1, axis=0).at[-1, :].set(False)
        down = jnp.roll(r, 1, axis=0).at[0, :].set(False)
        left = jnp.roll(r, -1, axis=1).at[:, -1].set(False)
        right = jnp.roll(r, 1, axis=1).at[:, 0].set(False)
        return (r | up | down | left | right) & passable

    def body(_, r):
        return dilate(r)

    reachable = jax.lax.fori_loop(0, k, body, reachable)
    return reachable.at[start].set(False)


