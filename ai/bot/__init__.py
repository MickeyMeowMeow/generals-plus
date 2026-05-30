"""Generals Plus bot package."""

from .observation import vision_to_observation
from .action import bot_action_to_game_action

__all__ = ["vision_to_observation", "bot_action_to_game_action"]
