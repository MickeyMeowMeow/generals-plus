"""
Action utilities for the JAX game simulator.

Action format: [pass, row, col, direction, split]
  - pass: 1 to skip turn, 0 to move
  - row, col: source cell coordinates
  - direction: 0=UP, 1=DOWN, 2=LEFT, 3=RIGHT
  - split: 1 to move half army, 0 to move all but one

Matches generals-plus TypeScript engine rules.
"""

import jax
import jax.numpy as jnp

# Direction offsets: UP, DOWN, LEFT, RIGHT
DIRECTIONS = jnp.array([[-1, 0], [1, 0], [0, -1], [0, 1]], dtype=jnp.int32)


@jax.jit
def compute_valid_move_mask(
    armies: jnp.ndarray,
    owned_cells: jnp.ndarray,
    mountains: jnp.ndarray,
) -> jnp.ndarray:
    """
    Compute valid move mask (H, W, 4).

    mask[i, j, d] is True if moving from (i, j) in direction d is valid.
    Valid when: source is owned, army > 1, destination in bounds and passable.
    """
    H, W = armies.shape

    can_move_from = owned_cells & (armies > 1)
    passable = ~mountains

    # Coordinate grids
    i_idx = jnp.arange(H)[:, None]
    j_idx = jnp.arange(W)[None, :]

    # Destination coords for all 4 directions: (H, W, 4)
    dest_i = i_idx[:, :, None] + DIRECTIONS[None, None, :, 0]
    dest_j = j_idx[:, :, None] + DIRECTIONS[None, None, :, 1]

    # Bounds check
    in_bounds = (dest_i >= 0) & (dest_i < H) & (dest_j >= 0) & (dest_j < W)

    # Safe indices for lookup
    safe_i = jnp.clip(dest_i, 0, H - 1)
    safe_j = jnp.clip(dest_j, 0, W - 1)

    dest_passable = passable[safe_i, safe_j]

    return can_move_from[:, :, None] & in_bounds & dest_passable
