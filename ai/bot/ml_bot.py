"""
MLBot: inference wrapper that loads a trained model and uses it to decide
actions in live games via the bot service.

Supports two backends (auto-detected by file extension):
  - .eqx  → JAX/Equinox (requires jax, equinox — used for training machines)
  - .onnx → ONNX Runtime (lightweight CPU-only deployment, ~30MB dependency)

Integrates with the existing BotFactory in server.py (loaded via --model flag).
Maintains LSTM hidden state across ticks for temporal memory.

Architecture (single-frame LSTM):
  Each tick, a single (spatial, scalar) observation is fed through the CNN
  backbone and LSTM cell. The LSTM hidden state is carried across ticks so
  the policy has access to accumulated temporal context.
"""

import logging
import warnings
from pathlib import Path
from typing import Optional

import numpy as np

from .observation import (
    SCALAR_DIM,
    compute_valid_move_mask,
    extract_scalar_features,
    vision_to_observation,
)

logger = logging.getLogger(__name__)


class MLBot:
    """
    Neural network bot that uses a trained CNN + LSTM model.

    Supports .eqx (JAX) and .onnx (ONNX Runtime) model formats.
    Processes one frame per tick; LSTM hidden state is carried across ticks.
    """

    def __init__(self, model_path: str, stack_size: int = 8):
        self.model_path = model_path
        if stack_size != 8:
            warnings.warn(
                f"stack_size={stack_size} is deprecated and ignored. "
                f"The model now uses single-frame LSTM processing.",
                DeprecationWarning,
                stacklevel=2,
            )
        self._backend: Optional[str] = None

        self._player_id: Optional[str] = None
        self._grid_shape: Optional[tuple[int, int]] = None  # (height, width)
        self._lstm_state = None
        self._hidden_dim: int = 128

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
        network = RecurrentPolicyValueNetwork(dummy_key, grid_size=10)
        self._network = eqx.tree_deserialise_leaves(model_path, network)
        self._hidden_dim = network.lstm_cell.hidden_size
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
        self._lstm_state = None

    def decide(self, tick_msg: dict) -> dict:
        """
        Entry point. Returns action dict {pass, row, col, direction, split}
        or a pass action if no valid move.

        Processes a single-frame observation through the CNN+LSTM network.
        LSTM state is carried across ticks for temporal memory.
        """
        vision = tick_msg.get("vision", [])
        grid_data = tick_msg.get("grid", {})
        self._player_id = tick_msg.get("player_id", "0")
        scoreboard = tick_msg.get("scoreboard", [])
        tick = tick_msg.get("tick", 0)

        width = grid_data.get("width", 0)
        height = grid_data.get("height", 0)

        if width == 0 or height == 0 or len(vision) == 0:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

        # Initialize LSTM state on first tick
        if self._lstm_state is None:
            self._grid_shape = (height, width)
            self._lstm_state = (
                np.zeros(self._hidden_dim, dtype=np.float32),
                np.zeros(self._hidden_dim, dtype=np.float32),
            )

        # Single-frame observation (no buffer needed — LSTM carries memory)
        spatial = vision_to_observation(vision, width, height, self._player_id)  # (9, H, W)
        scalars = extract_scalar_features(scoreboard, self._player_id, tick)      # (6,)

        # Compute valid move mask
        mask = compute_valid_move_mask(spatial)  # (H, W, 4)

        if self._backend == "jax":
            return self._infer_jax(spatial, scalars, mask)
        elif self._backend == "onnx":
            return self._infer_onnx(spatial, scalars, mask)
        else:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

    # ------------------------------------------------------------------
    # Inference backends
    # ------------------------------------------------------------------

    def _infer_jax(self, spatial: np.ndarray, scalar: np.ndarray, mask: np.ndarray) -> dict:
        """Run single-frame inference using JAX/Equinox backend."""
        spatial_jax = self._jnp.array(spatial)       # (9, H, W)
        scalar_jax = self._jnp.array(scalar)          # (6,)
        mask_jax = self._jnp.array(mask)

        self._key, action_key = self._jrandom.split(self._key)

        action_jax, new_state = self._network.inference(
            spatial_jax, scalar_jax, self._lstm_state, mask_jax, action_key,
        )
        self._lstm_state = new_state

        return {
            "pass": int(action_jax[0]),
            "row": int(action_jax[1]),
            "col": int(action_jax[2]),
            "direction": int(action_jax[3]),
            "split": int(action_jax[4]),
        }

    def _infer_onnx(self, spatial: np.ndarray, scalar: np.ndarray, mask: np.ndarray) -> dict:
        """Run single-frame inference using ONNX Runtime backend (CPU)."""
        h, c = self._lstm_state

        # Build ONNX inputs — single-frame shapes
        input_names = [inp.name for inp in self._session.get_inputs()]
        arrays = [
            spatial.astype(np.float32),       # (9, H, W)
            scalar.astype(np.float32),        # (6,)
            h.astype(np.float32),             # (hidden_dim,)
            c.astype(np.float32),             # (hidden_dim,)
            mask.astype(np.float32),          # (H, W, 4)
        ]
        input_feed = {}
        for name, arr in zip(input_names, arrays):
            input_feed[name] = arr

        outputs = self._session.run(None, input_feed)

        # Parse outputs: action (5,), h_new (hidden_dim,), c_new (hidden_dim,)
        action = outputs[0].flatten()
        if len(outputs) > 1:
            self._lstm_state = (outputs[1].flatten(), outputs[2].flatten())

        return {
            "pass": int(action[0]),
            "row": int(action[1]),
            "col": int(action[2]),
            "direction": int(action[3]),
            "split": int(action[4]),
        }
