"""
Reward functions for Generals Plus RL training.

Provides composite reward shaping based on:
  - Win/lose (general capture)
  - Army ratio change
  - Land ratio change
  - City capture
"""

import jax
import jax.numpy as jnp

from .types import Observation


def compute_num_cities_owned(obs: Observation) -> jnp.ndarray:
    """Count cities owned by the observing player."""
    return jnp.sum(obs.cities & obs.owned_cells).astype(jnp.float32)


def compute_num_generals_owned(obs: Observation) -> jnp.ndarray:
    """Count generals owned by the observing player."""
    return jnp.sum(obs.generals & obs.owned_cells).astype(jnp.float32)


@jax.jit
def composite_reward_fn(
    prior_obs: Observation,
    prior_action: jnp.ndarray,
    obs: Observation,
    city_weight: float = 0.4,
    ratio_weight: float = 0.3,
    maximum_army_ratio: float = 1.6,
    maximum_land_ratio: float = 1.3,
) -> jnp.ndarray:
    """
    Composite reward combining:
      - Base win/lose reward (generals owned change)
      - Army ratio reward
      - Land ratio reward
      - City capture reward

    Args:
        prior_obs: Observation before the action.
        prior_action: The action taken (5-element array).
        obs: Observation after the action.
        city_weight: Weight for city reward component.
        ratio_weight: Weight for ratio reward components.
        maximum_army_ratio: Clip parameter for army ratio.
        maximum_land_ratio: Clip parameter for land ratio.

    Returns:
        Scalar reward.
    """
    # Base reward: change in generals owned
    original_reward = (
        compute_num_generals_owned(obs) - compute_num_generals_owned(prior_obs)
    )

    # If game done, skip shaping
    game_done = (obs.owned_army_count == 0) | (obs.opponent_army_count == 0)

    def _ratio_reward(mine: jnp.ndarray, opponents: jnp.ndarray, max_ratio: float) -> jnp.ndarray:
        ratio = mine / jnp.maximum(opponents, 1.0)
        ratio = jnp.log(ratio) / jnp.log(max_ratio)
        return jnp.clip(ratio, -1.0, 1.0)

    # Army ratio shaping
    prev_army_ratio = _ratio_reward(
        prior_obs.owned_army_count.astype(jnp.float32),
        prior_obs.opponent_army_count.astype(jnp.float32),
        maximum_army_ratio,
    )
    curr_army_ratio = _ratio_reward(
        obs.owned_army_count.astype(jnp.float32),
        obs.opponent_army_count.astype(jnp.float32),
        maximum_army_ratio,
    )
    army_reward = curr_army_ratio - prev_army_ratio

    # Land ratio shaping
    prev_land_ratio = _ratio_reward(
        prior_obs.owned_land_count.astype(jnp.float32),
        prior_obs.opponent_land_count.astype(jnp.float32),
        maximum_land_ratio,
    )
    curr_land_ratio = _ratio_reward(
        obs.owned_land_count.astype(jnp.float32),
        obs.opponent_land_count.astype(jnp.float32),
        maximum_land_ratio,
    )
    land_reward = curr_land_ratio - prev_land_ratio

    # City capture shaping
    city_reward = compute_num_cities_owned(obs) - compute_num_cities_owned(prior_obs)

    shaped = (
        original_reward
        + ratio_weight * army_reward
        + city_weight * city_reward
        + ratio_weight * land_reward
    )

    return jnp.where(game_done, original_reward, shaped)
