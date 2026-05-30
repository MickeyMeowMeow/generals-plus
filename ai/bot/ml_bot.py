"""
MLBot: inference wrapper that loads a trained U-Net model and uses it to decide
actions in live games via the bot service.

Supports two backends (auto-detected by file extension):
  - .eqx  → JAX/Equinox (full training stack)
  - .onnx → ONNX Runtime (lightweight CPU-only deployment)

Uses memory channels (7 channels) instead of LSTM for temporal context.
MemoryState is maintained across ticks and reset on new game.
Variable grid sizes supported (reads from game state).
"""

import logging
import os
import sys
from pathlib import Path
from typing import Optional

import numpy as np

# Ensure imports work when loaded from bot server
_ai_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ai_dir not in sys.path:
    sys.path.insert(0, _ai_dir)

from .observation import (
    compute_valid_move_mask,
    vision_to_observation,
)
from sim.memory import init_memory, update_memory, memory_to_channels, MemoryState

logger = logging.getLogger(__name__)


def obs_to_spatial(obs_array: np.ndarray) -> np.ndarray:
    """Convert (9, H, W) observation to float32."""
    return obs_array.astype(np.float32)


class MLBot:
    """
    Neural network bot using U-Net + memory channels.

    Supports .eqx (JAX) and .onnx (ONNX Runtime) model formats.
    MemoryState is carried across ticks for temporal context (no LSTM).
    Variable grid sizes (reads from game state on first tick).
    """

    def __init__(self, model_path: str):
        self.model_path = model_path
        self._backend: Optional[str] = None

        self._player_id: Optional[str] = None
        self._grid_shape: Optional[tuple[int, int]] = None  # (height, width)
        self._memory: Optional[MemoryState] = None

        path = Path(model_path)
        if path.suffix == ".onnx":
            self._init_onnx(model_path)
        else:
            self._init_jax(model_path)

    # ------------------------------------------------------------------
    # Backend initialization
    # ------------------------------------------------------------------

    def _init_jax(self, model_path: str) -> None:
        """Load a JAX/Equinox .eqx model."""
        import jax.numpy as jnp
        import jax.random as jrandom
        import equinox as eqx

        from train.network import UNetPolicyValueNetwork

        dummy_key = jrandom.PRNGKey(0)
        network = UNetPolicyValueNetwork(dummy_key, grid_size=10)
        self._network = eqx.tree_deserialise_leaves(model_path, network)
        self._key = jrandom.PRNGKey(0)
        self._backend = "jax"
        self._jnp = jnp
        self._jrandom = jrandom
        logger.info(f"MLBot loaded JAX model from {model_path}")

    def _init_onnx(self, model_path: str) -> None:
        """Load an ONNX model for CPU inference via onnxruntime."""
        import onnxruntime as ort

        self._session = ort.InferenceSession(model_path)
        self._backend = "onnx"
        logger.info(f"MLBot loaded ONNX model from {model_path}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def reset(self, config: Optional[dict] = None) -> None:
        """Reset bot state for a new game."""
        self._player_id = None
        self._grid_shape = None
        self._memory = None

    def decide(self, tick_msg: dict) -> dict:
        """
        Entry point. Returns action dict {pass, row, col, direction, split}
        or a pass action if no valid move.

        Processes a single-frame observation through the U-Net with memory channels.
        """
        vision = tick_msg.get("vision", [])
        grid_data = tick_msg.get("grid", {})
        self._player_id = tick_msg.get("player_id", "0")
        tick = tick_msg.get("tick", 0)

        width = grid_data.get("width", 0)
        height = grid_data.get("height", 0)

        if width == 0 or height == 0 or len(vision) == 0:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

        # Initialize memory on first tick
        if self._memory is None:
            self._grid_shape = (height, width)
            self._memory = init_memory(height, width)

        # Build 9ch spatial observation
        spatial = vision_to_observation(vision, width, height, self._player_id)  # (9, H, W)

        # Build 15ch memory channels
        mem_channels = np.array(memory_to_channels(self._memory))  # (7, H, W)

        # Stack to 24ch input
        obs_24ch = np.concatenate([spatial, mem_channels], axis=0)  # (24, H, W)

        # Compute valid move mask
        mask = compute_valid_move_mask(spatial)  # (H, W, 4)

        if self._backend == "jax":
            return self._infer_jax(obs_24ch, mask, spatial)
        elif self._backend == "onnx":
            return self._infer_onnx(obs_24ch, mask, spatial)
        else:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

    # ------------------------------------------------------------------
    # Inference backends
    # ------------------------------------------------------------------

    def _infer_jax(self, obs_24ch: np.ndarray, mask: np.ndarray, spatial: np.ndarray) -> dict:
        """Run inference using JAX/Equinox backend."""
        obs_jax = self._jnp.array(obs_24ch)  # (24, H, W)
        mask_jax = self._jnp.array(mask)

        action_jax, value = self._network.inference(obs_jax, mask_jax)

        # Update memory with the action
        action_np = np.array(action_jax)
        # Build a minimal obs-like dict for memory update
        self._update_memory(spatial, action_np)

        return {
            "pass": int(action_jax[0]),
            "row": int(action_jax[1]),
            "col": int(action_jax[2]),
            "direction": int(action_jax[3]),
            "split": int(action_jax[4]),
        }

    def _infer_onnx(self, obs_24ch: np.ndarray, mask: np.ndarray, spatial: np.ndarray) -> dict:
        """Run inference using ONNX Runtime backend (CPU)."""
        input_names = [inp.name for inp in self._session.get_inputs()]
        arrays = [
            obs_24ch.astype(np.float32),   # (24, H, W)
            mask.astype(np.float32),        # (H, W, 4)
        ]
        input_feed = {}
        for name, arr in zip(input_names, arrays):
            input_feed[name] = arr

        outputs = self._session.run(None, input_feed)
        action = outputs[0].flatten()

        self._update_memory(spatial, action)

        return {
            "pass": int(action[0]),
            "row": int(action[1]),
            "col": int(action[2]),
            "direction": int(action[3]),
            "split": int(action[4]),
        }

    def _update_memory(self, spatial: np.ndarray, action: np.ndarray) -> None:
        """Update memory state with current observation and action."""
        import jax.numpy as jnp

        # Build a minimal Observation from spatial channels for memory update
        # spatial channels: armies, generals, cities, mountains, neutral, owned, opponent, fog, struct_fog
        H, W = spatial.shape[1], spatial.shape[2]
        from sim.types import Observation
        obs = Observation(
            armies=jnp.array(spatial[0]),
            generals=jnp.array(spatial[1]),
            cities=jnp.array(spatial[2]),
            mountains=jnp.array(spatial[3]),
            neutral_cells=jnp.array(spatial[4]),
            owned_cells=jnp.array(spatial[5]),
            opponent_cells=jnp.array(spatial[6]),
            fog_cells=jnp.array(spatial[7]),
            structures_in_fog=jnp.array(spatial[8]),
            owned_land_count=jnp.float32(0),  # not needed for memory
            owned_army_count=jnp.float32(0),
            opponent_land_count=jnp.float32(0),
            opponent_army_count=jnp.float32(0),
            timestep=jnp.int32(0),
        )
        self._memory = update_memory(obs, jnp.array(action, dtype=jnp.int32), self._memory)
