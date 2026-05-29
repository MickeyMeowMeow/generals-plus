"""
MLBot: inference wrapper that loads a trained model and uses it to decide
actions in live games via the bot service.

Supports two backends (auto-detected by file extension):
  - .eqx  → JAX/Equinox (requires jax, equinox — used for training machines)
  - .onnx → ONNX Runtime (lightweight CPU-only deployment, ~30MB dependency)

Integrates with the existing BotFactory in server.py (loaded via --model flag).
Maintains LSTM hidden state and an ObservationBuffer for temporal context.
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np

from .observation import (
    ObservationBuffer,
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
    Maintains ObservationBuffer + LSTM hidden state across ticks.
    """

    def __init__(self, model_path: str, stack_size: int = 8):
        self.model_path = model_path
        self.stack_size = stack_size
        self._backend: Optional[str] = None

        self._player_id: Optional[str] = None
        self._grid_shape: Optional[tuple[int, int]] = None  # (height, width)
        self._buffer: Optional[ObservationBuffer] = None
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

        from rl.network import RecurrentPolicyValueNetwork

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
        self._buffer = None
        self._lstm_state = None

    def decide(self, tick_msg: dict) -> dict:
        """
        Entry point. Returns action dict {pass, row, col, direction, split}
        or a pass action if no valid move.
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

        # Initialize buffer on first tick
        if self._buffer is None:
            self._grid_shape = (height, width)
            self._buffer = ObservationBuffer(
                stack_size=self.stack_size,
                spatial_shape=(9, height, width),
                scalar_dim=SCALAR_DIM,
            )
            # Initialize LSTM state
            self._lstm_state = (
                np.zeros(self._hidden_dim, dtype=np.float32),
                np.zeros(self._hidden_dim, dtype=np.float32),
            )

        # Build observations
        spatial = vision_to_observation(vision, width, height, self._player_id)
        scalars = extract_scalar_features(scoreboard, self._player_id, tick)

        self._buffer.push(spatial, scalars)
        spatial_seq, scalar_seq = self._buffer.get_sequence()

        # Compute valid move mask
        mask = compute_valid_move_mask(spatial)  # (H, W, 4)

        if self._backend == "jax":
            return self._infer_jax(spatial_seq, scalar_seq, mask)
        elif self._backend == "onnx":
            return self._infer_onnx(spatial_seq, scalar_seq, mask)
        else:
            return {"pass": 1, "row": 0, "col": 0, "direction": 0, "split": 0}

    # ------------------------------------------------------------------
    # Inference backends
    # ------------------------------------------------------------------

    def _infer_jax(self, spatial_seq: np.ndarray, scalar_seq: np.ndarray, mask: np.ndarray) -> dict:
        """Run inference using JAX/Equinox backend."""
        spatial_jax = self._jnp.array(spatial_seq)
        scalar_jax = self._jnp.array(scalar_seq)
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

    def _infer_onnx(self, spatial_seq: np.ndarray, scalar_seq: np.ndarray, mask: np.ndarray) -> dict:
        """Run inference using ONNX Runtime backend (CPU)."""
        h, c = self._lstm_state

        # Build ONNX inputs — names depend on the export, use positional
        input_feed = {}
        input_names = [inp.name for inp in self._session.get_inputs()]
        arrays = [
            spatial_seq.astype(np.float32),
            scalar_seq.astype(np.float32),
            h.astype(np.float32),
            c.astype(np.float32),
            mask.astype(np.float32),
        ]
        for name, arr in zip(input_names, arrays):
            input_feed[name] = arr

        outputs = self._session.run(None, input_feed)

        # Parse outputs: action (5,), h_new, c_new
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
