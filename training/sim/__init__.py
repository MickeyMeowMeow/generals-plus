"""
JAX-native game simulator for Generals Plus 1v1 training.

Matches the generals-plus TypeScript engine rules (NOT generals-bots).
Key differences from generals-bots:
  - Army increment: general/city +1 every tick, plain +1 every 25 ticks
  - General capture: captured general becomes a city, loser's cells transfer to winner
  - Vision: 3x3 radius around owned cells
"""

from .types import GameState, GameInfo, Observation
from .action import compute_valid_move_mask
from .game import step, get_observation, create_initial_state
from .env import GeneralsEnv
from .rewards import potential_based_reward
from .grid import generate_grid
