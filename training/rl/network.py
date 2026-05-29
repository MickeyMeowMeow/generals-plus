"""
CNN + LSTM Recurrent Policy-Value Network for Generals Plus.

Architecture:
    Spatial obs (9, H, W)  → CNN backbone → spatial features (flat vector)
                                                              │
                                                              ├─ concat → LSTM → value head
                                                              │
    Scoreboard scalars ───────→ scalar projection ────────────┘

    Policy head: uses CNN spatial features (action logits are spatial)
    Value head:  uses LSTM hidden state (temporal context)

Supports variable grid sizes via adaptive average pooling.
"""

from typing import Optional, Tuple

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx


class RecurrentPolicyValueNetwork(eqx.Module):
    """CNN + LSTM policy-value network for Generals Plus RL agent."""

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

    # Policy head (spatial — operates on CNN feature maps)
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
        keys = jrandom.split(key, 10)

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

        # Policy head: from CNN features → 9-channel spatial logits
        self.policy_conv = eqx.nn.Conv2d(channels[3], 9, kernel_size=1, key=keys[7])

        # Value head: from LSTM hidden → scalar value
        self.value_linear1 = eqx.nn.Linear(hidden_dim, 64, key=keys[8])
        self.value_linear2 = eqx.nn.Linear(64, 1, key=keys[9])

    def _cnn_features(self, obs: jnp.ndarray) -> Tuple[jnp.ndarray, jnp.ndarray]:
        """
        Run CNN backbone on a single spatial observation.

        Args:
            obs: shape (9, H, W)

        Returns:
            spatial_vector: shape (hidden_dim,) — for LSTM input
            feature_map: shape (channels[3], H, W) — for policy head
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

    def forward(
        self,
        spatial_seq: jnp.ndarray,
        scalar_seq: jnp.ndarray,
        lstm_state: Optional[Tuple[jnp.ndarray, jnp.ndarray]],
        mask: jnp.ndarray,
        key: jnp.ndarray,
        action: Optional[jnp.ndarray] = None,
    ) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray]:
        """
        Forward pass through CNN + LSTM.

        Args:
            spatial_seq: (T, 9, H, W) — observation history
            scalar_seq:  (T, scalar_dim) — scoreboard scalars per timestep
            lstm_state:  ((h,), (c,)) or None — LSTM hidden state
            mask:        (H, W, 4) — valid move mask for the current frame
            key:         JAX random key for action sampling
            action:      If provided, evaluate this action. Otherwise sample.

        Returns:
            (action, value, log_prob, entropy)
        """
        T = spatial_seq.shape[0]
        hidden_dim = self.lstm_cell.hidden_size

        # Initialize LSTM state if not provided
        if lstm_state is None:
            h0 = jnp.zeros(hidden_dim)
            c0 = jnp.zeros(hidden_dim)
            lstm_state = (h0, c0)

        # Run sequence through CNN + LSTM
        # We use the last CNN feature map for the policy head
        def scan_step(state, inputs):
            spatial_t, scalar_t = inputs
            spatial_vec, feat_map = self._cnn_features(spatial_t)
            scalar_vec = jax.nn.relu(self.scalar_linear(scalar_t))
            lstm_input = jnp.concatenate([spatial_vec, scalar_vec])
            new_state = self.lstm_cell(lstm_input, state)
            return new_state, feat_map

        final_state, feature_maps = jax.lax.scan(
            scan_step,
            lstm_state,
            (spatial_seq, scalar_seq),
        )

        # Use the last feature map for policy logits
        last_feat = feature_maps[-1]  # (channels[3], H, W)

        # Value from LSTM hidden state
        h = final_state[0]
        value_hidden = jax.nn.relu(self.value_linear1(h))
        value = self.value_linear2(value_hidden)[0]

        # Policy logits from CNN feature map
        logits = self.policy_conv(last_feat)  # (9, H, W)
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

        return action, value, logprob, entropy

    def inference(
        self,
        spatial_seq: jnp.ndarray,
        scalar_seq: jnp.ndarray,
        lstm_state: Optional[Tuple[jnp.ndarray, jnp.ndarray]],
        mask: jnp.ndarray,
        key: Optional[jnp.ndarray] = None,
    ) -> Tuple[jnp.ndarray, Tuple[jnp.ndarray, jnp.ndarray]]:
        """
        Inference-only forward pass — returns action and updated LSTM state.

        Args:
            spatial_seq: (T, 9, H, W)
            scalar_seq:  (T, scalar_dim)
            lstm_state:  ((h,), (c,)) or None
            mask:        (H, W, 4) valid move mask
            key:         optional JAX key (defaults to deterministic argmax if None)

        Returns:
            (action, lstm_state)
        """
        if key is None:
            key = jrandom.PRNGKey(0)

        hidden_dim = self.lstm_cell.hidden_size

        if lstm_state is None:
            h0 = jnp.zeros(hidden_dim)
            c0 = jnp.zeros(hidden_dim)
            lstm_state = (h0, c0)

        def scan_step(state, inputs):
            spatial_t, scalar_t = inputs
            spatial_vec, _ = self._cnn_features(spatial_t)
            scalar_vec = jax.nn.relu(self.scalar_linear(scalar_t))
            lstm_input = jnp.concatenate([spatial_vec, scalar_vec])
            new_state = self.lstm_cell(lstm_input, state)
            return new_state, None

        final_state, _ = jax.lax.scan(
            scan_step,
            lstm_state,
            (spatial_seq, scalar_seq),
        )

        # Policy from last spatial observation
        _, last_feat = self._cnn_features(spatial_seq[-1])
        logits = self.policy_conv(last_feat)

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

        return action, final_state
