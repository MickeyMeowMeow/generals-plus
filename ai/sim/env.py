"""
JAX-based Generals Plus 1v1 environment for RL training.

Stateless environment that manages pre-generated state pools for cheap
auto-reset during vectorized training.

Usage:
    >>> env = GeneralsEnv(grid_dims=(10, 10), truncation=500)
    >>> pool, state = env.reset(jrandom.PRNGKey(0))
    >>> timestep, state = env.step(state, actions, pool)
"""

from typing import NamedTuple

import jax
import jax.numpy as jnp
import jax.random as jrandom

from .game import GameState, GameInfo, create_initial_state, step as game_step
from .game import get_observation as game_get_observation
from .grid import generate_grid
from .types import Observation


class TimeStep(NamedTuple):
    """
    Result of a single environment step.

    Attributes:
        observation: Observation for the current player (P0).
        reward: Scalar reward for P0.
        terminated: True if game ended (general captured).
        truncated: True if max timesteps reached.
        info: GameInfo with statistics.
        last_state: GameState before auto-reset (for bootstrap values).
    """
    observation: Observation
    reward: jnp.ndarray
    terminated: jnp.ndarray
    truncated: jnp.ndarray
    info: GameInfo
    last_state: GameState


class GeneralsEnv:
    """
    Stateless JAX environment for 1v1 Generals Plus training.

    Key design:
        - reset() returns a pool of pre-generated GameStates + one initial state.
        - step() auto-resets from the pool when a game ends.
        - Fully vectorizable via jax.vmap.

    Example:
        >>> env = GeneralsEnv(grid_dims=(10, 10), truncation=500)
        >>> pool, state = env.reset(jrandom.PRNGKey(0))
        >>> # state shape: single GameState
        >>> # pool shape: (pool_size, ...) batched GameState
    """

    def __init__(
        self,
        grid_dims: tuple[int, int] | None = None,
        truncation: int = 500,
        mountain_density_range: tuple[float, float] = (0.18, 0.26),
        num_cities_range: tuple[int, int] = (9, 11),
        min_generals_distance: int = 0,
        pool_size: int = 10_000,
        castle_val_range: tuple[int, int] = (40, 51),
    ):
        if grid_dims is not None:
            h, w = grid_dims
        else:
            h, w = 10, 10

        self.grid_dims = (h, w)
        self.truncation = truncation
        self.mountain_density_range = mountain_density_range
        self.num_cities_range = num_cities_range
        self.min_generals_distance = min_generals_distance
        self.pool_size = pool_size
        self.castle_val_range = castle_val_range

    def _make_single_state(self, key: jnp.ndarray) -> GameState:
        """Generate a single GameState for the configured grid size."""
        grid = generate_grid(
            key,
            grid_dims=self.grid_dims,
            mountain_density_range=self.mountain_density_range,
            num_cities_range=self.num_cities_range,
            min_generals_distance=self.min_generals_distance,
            castle_val_range=self.castle_val_range,
        )
        return create_initial_state(grid.astype(jnp.int32))

    def reset(self, key: jnp.ndarray) -> tuple[GameState, GameState]:
        """
        Generate a state pool and return (pool, init_state).

        Args:
            key: JAX random key.

        Returns:
            (pool, init_state) where pool has shape (pool_size, ...).
        """
        k_pool, k_init = jrandom.split(key)
        pool_keys = jrandom.split(k_pool, self.pool_size)
        pool = jax.vmap(self._make_single_state)(pool_keys)
        init_state = self._make_single_state(k_init)
        return pool, init_state

    def init_state(self, key: jnp.ndarray) -> GameState:
        """Generate a single initial state (without regenerating pool)."""
        return self._make_single_state(key)

    def step(
        self,
        state: GameState,
        actions: jnp.ndarray,
        pool: GameState,
    ) -> tuple[TimeStep, GameState]:
        """
        Execute one step with auto-reset from pool.

        Args:
            state: Current GameState (single, not batched).
            actions: (2, 5) array — actions for both players.
            pool: Batched GameState (pool_size, ...) for auto-reset.

        Returns:
            (TimeStep, new_state). new_state is auto-reset if game ended.
        """
        # Step the game
        new_state, info = game_step(state, actions)

        # Win/lose reward for P0
        reward = jnp.where(
            info.winner == 0, 1.0,
            jnp.where(info.winner == 1, -1.0, 0.0),
        )

        # Done flags
        terminated = info.is_done
        truncated = (new_state.time >= self.truncation) & ~terminated
        should_reset = terminated | truncated

        # Auto-reset from pool
        pool_idx = new_state.pool_idx
        reset_state = jax.tree.map(lambda x: x[pool_idx % self.pool_size], pool)
        new_pool_idx = jnp.where(should_reset, pool_idx + 1, pool_idx)
        reset_state = reset_state._replace(pool_idx=new_pool_idx)
        new_state = new_state._replace(pool_idx=new_pool_idx)

        final_state = jax.tree.map(
            lambda r, c: jnp.where(should_reset, r, c),
            reset_state, new_state,
        )

        # Observation for P0
        obs = game_get_observation(final_state, 0)

        timestep = TimeStep(
            observation=obs,
            reward=reward,
            terminated=terminated,
            truncated=truncated,
            info=info,
            last_state=new_state,
        )

        return timestep, final_state
