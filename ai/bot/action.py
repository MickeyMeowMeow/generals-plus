"""
Action conversion: Python model action → TS game action format.
"""

DIRECTION_OFFSETS = [
    {"dx": 0, "dy": -1},   # 0 = UP
    {"dx": 0, "dy": 1},    # 1 = DOWN
    {"dx": -1, "dy": 0},   # 2 = LEFT
    {"dx": 1, "dy": 0},    # 3 = RIGHT
]


def bot_action_to_game_action(action: dict | None) -> dict | None:
    """
    Convert a model action [pass, row, col, direction, split] to a game move dict.
    Returns None if the bot skips (pass).
    """
    if action is None or action.get("pass", 0):
        return None

    direction = action.get("direction", 0)
    offset = DIRECTION_OFFSETS[direction]
    col = action.get("col", 0)
    row = action.get("row", 0)
    split = action.get("split", 0)

    return {
        "type": "split_move" if split else "move",
        "from": {"x": col, "y": row},
        "to": {"x": col + offset["dx"], "y": row + offset["dy"]},
    }
