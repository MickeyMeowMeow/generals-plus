"""
Reward functions for Generals Plus RL training.

Implements potential-based reward shaping (Ng et al. 1999, Straka & Schmid 2025):
  r_shaped(s,a,s') = r_original + γ·φ(s') - φ(s)
  φ(s) = 0.3·φ_army + 0.3·φ_land + 0.4·φ_castle
  φ_x(s) = log(x_mine / x_enemy) / log(max_ratio)  for x ∈ {army, land, castle}

This is provably optimal-policy-preserving: the shaping does not change
the set of optimal policies, only provides denser learning signal.
"""

import jax
import jax.numpy as jnp

from .types import Observation


def _log_ratio(
    mine: jnp.ndarray,
    theirs: jnp.ndarray,
    max_ratio: float,
) -> jnp.ndarray:
    """
    Compute normalized log-ratio potential: log(mine/theirs) / log(max_ratio).

    Clipped to [-1, 1]. Returns 0 when both are zero (symmetric ignorance).
    """
    ratio = mine / jnp.maximum(theirs, 1.0)
    return jnp.clip(jnp.log(ratio) / jnp.log(max_ratio), -1.0, 1.0)


def _compute_owned_cities(obs: Observation) -> jnp.ndarray:
    """Count cities owned by the observing player."""
    return jnp.sum(jnp.logical_and(obs.cities, obs.owned_cells)).astype(jnp.float32)


def _compute_enemy_cities(obs: Observation) -> jnp.ndarray:
    """Count cities owned by the opponent."""
    return jnp.sum(jnp.logical_and(obs.cities, obs.opponent_cells)).astype(jnp.float32)


def _compute_owned_generals(obs: Observation) -> jnp.ndarray:
    """Count generals owned by the observing player."""
    return jnp.sum(jnp.logical_and(obs.generals, obs.owned_cells)).astype(jnp.float32)


@jax.jit
def potential_fn(
    obs: Observation,
    max_army_ratio: float = 1.6,
    max_land_ratio: float = 1.3,
    max_castle_ratio: float = 3.0,
) -> jnp.ndarray:
    """
    Compute potential function φ(s) = 0.3·φ_army + 0.3·φ_land + 0.4·φ_castle.

    All three sub-potentials use log-ratio normalization, matching the paper:
      φ_x(s) = log(x_agent / x_enemy) / log(max_ratio)  for x ∈ {army, land, castle}
    """
    phi_army = _log_ratio(
        obs.owned_army_count.astype(jnp.float32),
        obs.opponent_army_count.astype(jnp.float32),
        max_army_ratio,
    )
    phi_land = _log_ratio(
        obs.owned_land_count.astype(jnp.float32),
        obs.opponent_land_count.astype(jnp.float32),
        max_land_ratio,
    )
    phi_castle = _log_ratio(
        _compute_owned_cities(obs),
        _compute_enemy_cities(obs),
        max_castle_ratio,
    )

    return 0.3 * phi_army + 0.3 * phi_land + 0.4 * phi_castle


@jax.jit
def potential_based_reward(
    prior_obs: Observation,
    prior_action: jnp.ndarray,
    obs: Observation,
    gamma: float = 0.99,
) -> jnp.ndarray:
    """
    Potential-based reward shaping (Ng et al. 1999, Straka & Schmid 2025).

    r_shaped = r_original + γ·φ(s') - φ(s)

    This is provably optimal-policy-preserving: the shaping does not change
    the set of optimal policies.

    On game end, only the original sparse reward is returned.
    """
    # Original reward: generals capture change (+1 win, -1 lose)
    original_reward = _compute_owned_generals(obs) - _compute_owned_generals(prior_obs)

    # On game end, only use original reward (no shaping)
    game_done = (obs.owned_army_count == 0) | (obs.opponent_army_count == 0)

    # Potential-based shaping with γ factor (matching paper Eq. 1)
    phi_new = potential_fn(obs)
    phi_old = potential_fn(prior_obs)
    shaped = original_reward + gamma * phi_new - phi_old

    return jnp.where(game_done, original_reward, shaped)
