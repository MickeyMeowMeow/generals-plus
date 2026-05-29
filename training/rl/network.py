"""
CNN + LSTM Recurrent Policy-Value Network for Generals Plus.

Architecture:
    Spatial obs (9, H, W)  → CNN backbone → spatial features (flat vector)
                                                              │
                                                              ├─ concat → LSTM → value head
                                                              │                  │
    Scoreboard scalars ──────→ scalar projection ────────────┘                  │
                                                                                 │
    LSTM hidden ──→ tanh projection → broadcast-add to CNN feature map           │
                                                              │                  │
                                                       policy head               │
                                                       (action logits)           │

    Policy head: uses CNN spatial features MODULATED by LSTM hidden state
                 (enables memory-aware action selection)
    Value head:  uses LSTM hidden state (temporal context)

Supports variable grid sizes via adaptive average pooling.
Processes ONE frame per call — LSTM state is carried externally.
"""

from typing import Optional, Tuple

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx


class RecurrentPolicyValueNetwork(eqx.Module):
    """CNN + LSTM policy-value network for Generals Plus RL agent.

    Single-frame interface: each call processes one spatial+scalar observation
    through the CNN backbone and LSTM cell. The caller is responsible for
    maintaining the LSTM hidden state across timesteps.
    """

    # CNN backbone
    conv1: eqx.nn.Conv2d
    conv2: eqx.nn.Conv2d
    conv3: eqx.nn.Conv2d
    conv4: eqx.nn.Conv2d
    pool: eqx.nn.AdaptiveAvgPool2d

    # Spatial feature projection
    spatial_linear: eqx.nn.Linear

    # Scalar projection
    scalar_linear: eqx.nn.Linear

    # LSTM
    lstm_cell: eqx.nn.LSTMCell

    # LSTM-to-policy modulation: hidden_dim → channels[-1]
    lstm_to_policy: eqx.nn.Linear

    # Policy head (spatial — operates on modulated CNN feature maps)
    policy_conv: eqx.nn.Conv2d  # → 9 channels (4 dirs + 4 split dirs + 1 pass)

    # Value head (from LSTM hidden state)
    value_linear1: eqx.nn.Linear
    value_linear2: eqx.nn.Linear

    def __init__(
        self,
        key: jnp.ndarray,
        grid_size: int = 10,
        channels: tuple[int, ...] = (32, 32, 32, 16),
        hidden_dim: int = 128,
        scalar_dim: int = 6,
    ):
        keys = jrandom.split(key, 11)

        # CNN backbone — 4 conv layers with 3x3 kernels and padding
        self.conv1 = eqx.nn.Conv2d(9, channels[0], kernel_size=3, padding=1, key=keys[0])
        self.conv2 = eqx.nn.Conv2d(channels[0], channels[1], kernel_size=3, padding=1, key=keys[1])
        self.conv3 = eqx.nn.Conv2d(channels[1], channels[2], kernel_size=3, padding=1, key=keys[2])
        self.conv4 = eqx.nn.Conv2d(channels[2], channels[3], kernel_size=3, padding=1, key=keys[3])

        # Adaptive pooling to a fixed spatial size for variable grid support
        self.pool = eqx.nn.AdaptiveAvgPool2d((2, 2))

        # Spatial feature projection: channels[3] * 2 * 2 → hidden_dim
        self.spatial_linear = eqx.nn.Linear(channels[3] * 4, hidden_dim, key=keys[4])

        # Scalar projection
        self.scalar_linear = eqx.nn.Linear(scalar_dim, hidden_dim, key=keys[5])

        # LSTM cell: input = concat(spatial_features, scalar_features)
        self.lstm_cell = eqx.nn.LSTMCell(hidden_dim * 2, hidden_dim, key=keys[6])

        # LSTM-to-policy modulation: project hidden state to feature-map channels
        self.lstm_to_policy = eqx.nn.Linear(hidden_dim, channels[3], key=keys[7])

        # Policy head: from modulated CNN features → 9-channel spatial logits
        self.policy_conv = eqx.nn.Conv2d(channels[3], 9, kernel_size=1, key=keys[8])

        # Value head: from LSTM hidden → scalar value
        self.value_linear1 = eqx.nn.Linear(hidden_dim, 64, key=keys[9])
        self.value_linear2 = eqx.nn.Linear(64, 1, key=keys[10])

    def _cnn_features(self, obs: jnp.ndarray) -> Tuple[jnp.ndarray, jnp.ndarray]:
        """
        Run CNN backbone on a single spatial observation.

        Args:
            obs: shape (9, H, W)

        Returns:
            spatial_vector: shape (hidden_dim,) — for LSTM input (no modulation)
            feature_map: shape (channels[3], H, W) — for policy head (no modulation)
        """
        x = jax.nn.relu(self.conv1(obs))
        x = jax.nn.relu(self.conv2(x))
        x = jax.nn.relu(self.conv3(x))
        feature_map = jax.nn.relu(self.conv4(x))

        # Adaptive pool + flatten for LSTM
        pooled = self.pool(feature_map)
        flat = pooled.reshape(-1)
        spatial_vector = jax.nn.relu(self.spatial_linear(flat))

        return spatial_vector, feature_map

    def _modulate_feature_map(
        self, feature_map: jnp.ndarray, lstm_h: jnp.ndarray
    ) -> jnp.ndarray:
        """Broadcast-add LSTM hidden context to the CNN feature map.

        Uses tanh to bound the modulation to [-1, 1] so the LSTM can't
        overwhelm the spatial features.
        """
        modulation = jax.nn.tanh(self.lstm_to_policy(lstm_h))  # (C,)
        return feature_map + modulation[:, None, None]  # (C, H, W)

    def forward(
        self,
        spatial: jnp.ndarray,
        scalar: jnp.ndarray,
        lstm_state: Optional[Tuple[jnp.ndarray, jnp.ndarray]],
        mask: jnp.ndarray,
        key: jnp.ndarray,
        action: Optional[jnp.ndarray] = None,
    ) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray, Tuple[jnp.ndarray, jnp.ndarray]]:
        """
        Single-frame forward pass through CNN + LSTM.

        Args:
            spatial:     (9, H, W) — current spatial observation
            scalar:      (scalar_dim,) — current scoreboard scalars
            lstm_state:  ((h,), (c,)) or None — LSTM hidden state from previous step
            mask:        (H, W, 4) — valid move mask for the current frame
            key:         JAX random key for action sampling
            action:      If provided, evaluate this action. Otherwise sample.

        Returns:
            (action, value, log_prob, entropy, new_lstm_state)
        """
        hidden_dim = self.lstm_cell.hidden_size

        # Initialize LSTM state if not provided
        if lstm_state is None:
            h0 = jnp.zeros(hidden_dim)
            c0 = jnp.zeros(hidden_dim)
            lstm_state = (h0, c0)

        # CNN backbone on single frame
        spatial_vec, feature_map = self._cnn_features(spatial)  # no modulation

        # Scalar projection
        scalar_vec = jax.nn.relu(self.scalar_linear(scalar))

        # LSTM step
        lstm_input = jnp.concatenate([spatial_vec, scalar_vec])
        new_lstm_state = self.lstm_cell(lstm_input, lstm_state)

        # Value from new LSTM hidden state
        new_h = new_lstm_state[0]
        value_hidden = jax.nn.relu(self.value_linear1(new_h))
        value = self.value_linear2(value_hidden)[0]

        # Policy from CNN feature map modulated by new LSTM hidden state
        modulated_feat = self._modulate_feature_map(feature_map, new_h)
        logits = self.policy_conv(modulated_feat)  # (9, H, W)
        grid_size = logits.shape[-1]

        # Apply valid move mask
        mask_t = jnp.transpose(mask, (2, 0, 1))  # (4, H, W)
        mask_penalty = (1 - mask_t) * -1e9
        combined_mask = jnp.concatenate([
            mask_penalty,  # 4 directions
            mask_penalty,  # 4 split-move directions
            jnp.zeros((1, grid_size, grid_size)),  # pass action
        ], axis=0)
        logits_flat = (logits + combined_mask).reshape(-1)

        grid_cells = grid_size * grid_size

        if action is None:
            # Sample action
            idx = jrandom.categorical(key, logits_flat)
            direction, position = idx // grid_cells, idx % grid_cells
            row, col = position // grid_size, position % grid_size
            is_pass = direction == 8
            is_half = (direction >= 4) & (direction < 8)
            actual_dir = jnp.where(is_pass, 0, jnp.where(is_half, direction - 4, direction))
            action = jnp.array([is_pass, row, col, actual_dir, is_half], dtype=jnp.int32)
        else:
            # Compute index from provided action
            is_pass, row, col, direction, is_half = action
            encoded_dir = jnp.where(is_pass > 0, 8, jnp.where(is_half > 0, direction + 4, direction))
            idx = encoded_dir * grid_cells + row * grid_size + col

        # Log probability and entropy
        log_probs = jax.nn.log_softmax(logits_flat)
        logprob = log_probs[idx]
        probs = jax.nn.softmax(logits_flat)
        entropy = -jnp.sum(probs * log_probs)

        return action, value, logprob, entropy, new_lstm_state

    def inference(
        self,
        spatial: jnp.ndarray,
        scalar: jnp.ndarray,
        lstm_state: Optional[Tuple[jnp.ndarray, jnp.ndarray]],
        mask: jnp.ndarray,
        key: Optional[jnp.ndarray] = None,
    ) -> Tuple[jnp.ndarray, Tuple[jnp.ndarray, jnp.ndarray]]:
        """
        Single-frame inference-only forward pass.

        Args:
            spatial:     (9, H, W)
            scalar:      (scalar_dim,)
            lstm_state:  ((h,), (c,)) or None
            mask:        (H, W, 4) valid move mask
            key:         optional JAX key (defaults to deterministic argmax if None)

        Returns:
            (action, new_lstm_state)
        """
        if key is None:
            key = jrandom.PRNGKey(0)

        hidden_dim = self.lstm_cell.hidden_size

        if lstm_state is None:
            h0 = jnp.zeros(hidden_dim)
            c0 = jnp.zeros(hidden_dim)
            lstm_state = (h0, c0)

        # CNN backbone
        spatial_vec, feature_map = self._cnn_features(spatial)

        # Scalar projection
        scalar_vec = jax.nn.relu(self.scalar_linear(scalar))

        # LSTM step
        lstm_input = jnp.concatenate([spatial_vec, scalar_vec])
        new_lstm_state = self.lstm_cell(lstm_input, lstm_state)

        # Policy from modulated feature map
        new_h = new_lstm_state[0]
        modulated_feat = self._modulate_feature_map(feature_map, new_h)
        logits = self.policy_conv(modulated_feat)

        grid_size = logits.shape[-1]
        mask_t = jnp.transpose(mask, (2, 0, 1))
        mask_penalty = (1 - mask_t) * -1e9
        combined_mask = jnp.concatenate([
            mask_penalty,
            mask_penalty,
            jnp.zeros((1, grid_size, grid_size)),
        ], axis=0)
        logits_flat = (logits + combined_mask).reshape(-1)

        grid_cells = grid_size * grid_size
        idx = jrandom.categorical(key, logits_flat)
        direction, position = idx // grid_cells, idx % grid_cells
        row, col = position // grid_size, position % grid_size
        is_pass = direction == 8
        is_half = (direction >= 4) & (direction < 8)
        actual_dir = jnp.where(is_pass, 0, jnp.where(is_half, direction - 4, direction))
        action = jnp.array([is_pass, row, col, actual_dir, is_half], dtype=jnp.int32)

        return action, new_lstm_state
