"""
Observation conversion: TS VisionCellJSON[] → NumPy 9-channel spatial tensor
+ scoreboard scalar features + ObservationBuffer for recurrent memory.

Spatial channels (9, H, W):
  0: armies
  1: generals
  2: cities
  3: mountains
  4: neutral_cells
  5: owned_cells
  6: opponent_cells
  7: fog_cells
  8: structures_in_fog

Scalar features (from public scoreboard — same data all players see):
  owned_land, owned_army, opponent_land, opponent_army, tick, num_alive
"""

from collections import deque
from typing import Optional

import numpy as np


def vision_to_observation(
    vision: list[dict],
    width: int,
    height: int,
    player_id: str,
) -> np.ndarray:
    """Convert TS VisionCellJSON[] to a 9-channel observation array of shape (9, H, W)."""
    obs = np.zeros((9, height, width), dtype=np.float32)

    for i, cell in enumerate(vision):
        row = i // width
        col = i % width
        if row >= height:
            break

        visibility = cell["visibility"]
        terrain = cell["terrain"]

        if visibility == "visible":
            obs[0, row, col] = max(cell.get("troop_count", 0), 0)  # armies
            obs[1, row, col] = 1.0 if cell.get("is_general", False) else 0.0  # generals
            obs[2, row, col] = 1.0 if cell.get("is_city", False) else 0.0  # cities

            owner = cell.get("owner_index", "")
            if owner == "":
                if terrain not in ("mountain", "void"):
                    obs[4, row, col] = 1.0  # neutral_cells
            elif owner == player_id:
                obs[5, row, col] = 1.0  # owned_cells
            else:
                obs[6, row, col] = 1.0  # opponent_cells

        if terrain in ("mountain", "void"):
            obs[3, row, col] = 1.0  # mountains

        if visibility in ("hidden", "shrouded"):
            # TS engine has 4 visibility levels: visible, terrain, shrouded, hidden.
            # We map these to 2 channels:
            #   structures_in_fog: shrouded/hidden cells on mountain/void (static map features
            #     that can be remembered — terrain won't change under fog)
            #   fog_cells: shrouded/hidden cells on passable terrain (may contain troops,
            #     ownership changes — dynamic information hidden by fog)
            if terrain in ("mountain", "void"):
                obs[8, row, col] = 1.0  # structures_in_fog
            else:
                obs[7, row, col] = 1.0  # fog_cells

    return obs


def compute_valid_move_mask(
    obs: np.ndarray,
) -> np.ndarray:
    """
    Compute valid move mask [H, W, 4] from observation.
    A move (row, col, dir) is valid if:
      - Source cell is owned by us
      - Source cell has troops > 1
      - Destination cell is within grid bounds
      - Destination cell is not a mountain
    """
    height, width = obs.shape[1], obs.shape[2]
    owned = obs[5]  # [H, W]
    armies = obs[0]  # [H, W]
    mountains = obs[3]  # [H, W]

    mask = np.zeros((height, width, 4), dtype=np.int32)
    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]  # UP, DOWN, LEFT, RIGHT

    for d, (dr, dc) in enumerate(dirs):
        for r in range(height):
            for c in range(width):
                nr, nc = r + dr, c + dc
                if 0 <= nr < height and 0 <= nc < width:
                    if (
                        owned[r, c] > 0
                        and armies[r, c] > 1
                        and mountains[nr, nc] == 0
                    ):
                        mask[r, c, d] = 1

    return mask


# ---------------------------------------------------------------------------
# Scoreboard scalar features
# ---------------------------------------------------------------------------

SCALAR_DIM = 6  # owned_land, owned_army, opponent_land, opponent_army, tick, num_alive


def extract_scalar_features(
    scoreboard: list[dict],
    player_id: str,
    tick: int,
) -> np.ndarray:
    """
    Extract a flat scalar feature vector from the public scoreboard.

    Returns ndarray of shape (SCALAR_DIM,) with:
      [owned_land, owned_army, opponent_land, opponent_army, tick, num_alive]

    Uses only public scoreboard data — same information human players see.
    """
    owned_land = 0
    owned_army = 0
    opponent_land = 0
    opponent_army = 0
    num_alive = 0

    for entry in scoreboard:
        pid = entry.get("playerId", "")
        troops = entry.get("troops", 0)
        land = entry.get("land", 0)
        is_alive = entry.get("isAlive", False)

        if is_alive:
            num_alive += 1

        if pid == player_id:
            owned_land = land
            owned_army = troops
        else:
            opponent_land += land
            opponent_army += troops

    return np.array(
        [owned_land, owned_army, opponent_land, opponent_army, tick, num_alive],
        dtype=np.float32,
    )


# ---------------------------------------------------------------------------
# Observation buffer for recurrent memory
# ---------------------------------------------------------------------------


class ObservationBuffer:
    """
    Rolling buffer of (spatial, scalar) observation pairs.

    Provides temporal context for recurrent policies (LSTM).
    Empty slots are filled with zero tensors until the buffer is full.
    """

    def __init__(
        self,
        spatial_shape: tuple[int, int, int],  # required: (C, H, W) for actual grid
        stack_size: int = 8,
        scalar_dim: int = SCALAR_DIM,
    ):
        self.stack_size = stack_size
        self.spatial_shape = spatial_shape
        self.scalar_dim = scalar_dim
        self._spatial_buf: deque[np.ndarray] = deque(maxlen=stack_size)
        self._scalar_buf: deque[np.ndarray] = deque(maxlen=stack_size)

    def push(self, spatial: np.ndarray, scalars: np.ndarray) -> None:
        """Append a new observation pair, evicting the oldest if full."""
        self._spatial_buf.append(spatial)
        self._scalar_buf.append(scalars)

    def reset(self) -> None:
        """Clear the buffer."""
        self._spatial_buf.clear()
        self._scalar_buf.clear()

    def get_sequence(
        self,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Return the buffered sequence padded with leading zeros.

        Returns:
            spatial_batch: ndarray of shape (T, C, H, W)
            scalar_batch:  ndarray of shape (T, scalar_dim)
        where T = stack_size. Unfilled timesteps are zeros.
        """
        num_stored = len(self._spatial_buf)
        pad = self.stack_size - num_stored

        zero_spatial = np.zeros(self.spatial_shape, dtype=np.float32)
        zero_scalar = np.zeros(self.scalar_dim, dtype=np.float32)

        spatial_list = [zero_spatial] * pad + list(self._spatial_buf)
        scalar_list = [zero_scalar] * pad + list(self._scalar_buf)

        return (
            np.stack(spatial_list, axis=0),
            np.stack(scalar_list, axis=0),
        )

    @property
    def num_stored(self) -> int:
        return len(self._spatial_buf)
