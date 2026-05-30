"""
HeuristicBot: evaluation-function-based bot for Generals Plus.

Serves as the baseline/fallback bot that works without any ML training.
Based on the ExpanderAgent pattern from strakam/generals-bots, adapted for
the generals-plus vision format.

Strategy priority:
  1. Attack enemy General (highest priority, always attack if can win)
  2. Defend own General if threatened
  3. Capture cities
  4. Expand to neutral territory
  5. Consolidate forces toward border
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GridInfo:
    width: int
    height: int
    num_cells: int = field(init=False)

    def __post_init__(self):
        self.num_cells = self.width * self.height


DIRECTIONS = [
    ("UP", 0, -1),
    ("DOWN", 0, 1),
    ("LEFT", -1, 0),
    ("RIGHT", 1, 0),
]

# ---------------------------------------------------------------------------
# Evaluation weights
# ---------------------------------------------------------------------------
WEIGHT_GENERAL_ATTACK = 10000   # Always attack enemy general if we have more troops
WEIGHT_CITY_CAPTURE = 500       # High value for capturing cities
WEIGHT_NEUTRAL = 10             # Expand to neutral cells
MIN_SOURCE_TROOPS = 2           # Minimum troops to move from a cell


class HeuristicBot:
    """
    Pure heuristic bot that evaluates all valid moves and picks the best one
    using a weighted scoring function. No ML required.
    """

    def __init__(self):
        self._player_id: Optional[str] = None
        self._grid: Optional[GridInfo] = None
        self._known_enemy_general: Optional[tuple[int, int]] = None

    # ------------------------------------------------------------------
    # Public API (called from bot server)
    # ------------------------------------------------------------------

    def reset(self, config: Optional[dict] = None) -> None:
        self._player_id = None
        self._grid = None
        self._known_enemy_general = None

    def decide(self, tick_msg: dict) -> dict | None:
        """
        Entry point. Returns a model action dict {pass, row, col, direction, split}
        or None to skip this tick.
        """
        vision = tick_msg.get("vision", [])
        grid_data = tick_msg.get("grid", {})
        self._player_id = tick_msg.get("player_id", "0")

        width = grid_data.get("width", 0)
        height = grid_data.get("height", 0)
        if width == 0 or height == 0 or len(vision) == 0:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

        self._grid = GridInfo(width, height)
        best = self._evaluate(vision)
        if best is None:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

        row, col, direction, split = best
        return {"pass": 0, "row": row, "col": col, "direction": direction, "split": split}

    # ------------------------------------------------------------------
    # Core evaluation
    # ------------------------------------------------------------------

    def _evaluate(self, vision: list[dict]) -> Optional[tuple[int, int, int, int]]:
        """
        Score every valid move and return (row, col, direction, split) for the best.
        Returns None if no valid move is found.
        """
        best_score = -float("inf")
        best_move = None
        my_general_pos = None
        enemy_general_pos = None

        # First pass: locate generals
        for i, cell in enumerate(vision):
            row, col = divmod(i, self._grid.width)
            if cell.get("visibility") != "visible":
                continue
            if cell.get("is_general"):
                owner = cell.get("owner_index", "")
                if owner == self._player_id:
                    my_general_pos = (row, col)
                elif owner != "":
                    enemy_general_pos = (row, col)
                    self._known_enemy_general = (row, col)

        # Use cached enemy general if not visible now
        if enemy_general_pos is None and self._known_enemy_general is not None:
            enemy_general_pos = self._known_enemy_general

        # Second pass: score each valid move
        for i, cell in enumerate(vision):
            row, col = divmod(i, self._grid.width)

            if cell.get("visibility") != "visible":
                continue
            if cell.get("owner_index") != self._player_id:
                continue

            troop_count = cell.get("troop_count", 0)
            if troop_count < MIN_SOURCE_TROOPS:
                continue

            for d, (_, dx, dy) in enumerate(DIRECTIONS):
                nr, nc = row + dy, col + dx
                if not (0 <= nr < self._grid.height and 0 <= nc < self._grid.width):
                    continue

                target_idx = nr * self._grid.width + nc
                if target_idx >= len(vision):
                    continue

                target_cell = vision[target_idx]
                target_terrain = target_cell.get("terrain", "")

                # Cannot move into mountains or void
                if target_terrain in ("mountain", "void"):
                    continue

                # Can move into fog cells (they're not mountains)
                # Skip only completely hidden cells with hidden terrain
                if target_cell.get("visibility") == "hidden" and target_terrain == "hidden":
                    continue

                # Score this move
                target_troops = target_cell.get("troop_count", 0)
                if target_cell.get("visibility") != "visible":
                    target_troops = 0

                target_owner = target_cell.get("owner_index", "")
                is_my_cell = target_owner == self._player_id
                can_win = troop_count > target_troops

                # Compute score components
                score = 0.0

                # 1. Attack enemy General — highest priority
                if target_cell.get("is_general") and target_owner != self._player_id and can_win:
                    score += WEIGHT_GENERAL_ATTACK

                # 2. Capture city
                elif target_cell.get("is_city") and not is_my_cell and can_win:
                    score += WEIGHT_CITY_CAPTURE + (troop_count - target_troops)

                # 3. Expand to neutral
                elif target_owner == "" and target_terrain not in ("mountain", "void", "hidden"):
                    score += WEIGHT_NEUTRAL + (troop_count - target_troops) * 0.5

                # 4. Move between own cells (consolidate toward border)
                elif is_my_cell:
                    score -= 1.0

                # 5. Attack enemy cell
                elif target_owner != self._player_id and target_owner != "":
                    if can_win:
                        score += 20 + (troop_count - target_troops)
                    else:
                        score -= 10  # Don't suicide into stronger enemy

                # 6. Proximity bonus toward enemy general (guide movement)
                if enemy_general_pos is not None:
                    current_dist = abs(row - enemy_general_pos[0]) + abs(col - enemy_general_pos[1])
                    new_dist = abs(nr - enemy_general_pos[0]) + abs(nc - enemy_general_pos[1])
                    score += (current_dist - new_dist) * 2.0

                # 7. Avoid moving from own general with few troops
                if my_general_pos is not None and (row, col) == my_general_pos:
                    if troop_count < 10:
                        score -= 50

                # 8. Don't split when attacking high-value targets (full force)
                split_pref = 0 if (target_cell.get("is_general") or target_cell.get("is_city")) else (1 if troop_count > 8 else 0)

                # Track best
                if score > best_score:
                    best_score = score
                    best_move = (row, col, d, split_pref)

        return best_move
