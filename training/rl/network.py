"""
U-Net Policy-Value Network for Generals Plus.

Architecture (following paper's U-Net design):
  Input: (16, H, W) — 9 obs channels + 7 memory channels
    │
    ├─ Encoder Block 1: Conv(16→64, 3, pad=1) + ReLU → skip_1
    ├─ MaxPool2d(2)
    ├─ Encoder Block 2: Conv(64→128, 3, pad=1) + ReLU → skip_2
    ├─ MaxPool2d(2)
    │
    ├─ Bottleneck: Conv(128→256, 3, pad=1) + ReLU
    │
    ├─ Upsample + Conv(256→128, 1) + Cat(skip_2) → Conv(256→128, 3) + ReLU
    ├─ Upsample + Conv(128→64, 1)  + Cat(skip_1) → Conv(128→64, 3)  + ReLU
    │
    ├─ Policy head: Conv(64→9, 1) → (H, W, 9) logits
    └─ Value head: AdaptiveAvgPool(2,2) → FC → FC(1)

Variable grid size support:
  - Conv with padding=1 preserves spatial dims
  - Bilinear upsample restores spatial dims
  - AdaptiveAvgPool for grid-size-agnostic value head
  - Requires H and W divisible by 4 (pad if needed)
"""

from typing import Optional, Tuple

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx


class UNetPolicyValueNetwork(eqx.Module):
    """
    U-Net policy-value network with skip connections.

    No LSTM, no scalar projection — memory channels encode temporal info.
    Fully feedforward: single forward pass per frame, no state to carry.
    """

    # Encoder block 1
    enc1_conv: eqx.nn.Conv2d

    # Encoder block 2
    enc2_conv: eqx.nn.Conv2d

    # Bottleneck
    bot_conv: eqx.nn.Conv2d

    # Decoder block 2
    dec2_up_conv: eqx.nn.Conv2d   # 1x1 conv after upsample
    dec2_conv: eqx.nn.Conv2d

    # Decoder block 1
    dec1_up_conv: eqx.nn.Conv2d   # 1x1 conv after upsample
    dec1_conv: eqx.nn.Conv2d

    # Policy head
    policy_conv: eqx.nn.Conv2d   # 64 → 9

    # Value head
    value_pool: eqx.nn.AdaptiveAvgPool2d
    value_fc1: eqx.nn.Linear
    value_fc2: eqx.nn.Linear

    def __init__(self, key: jnp.ndarray, grid_size: int = 10):
        """
        Args:
            key: JAX random key.
            grid_size: Hint for buffer sizing (network is grid-size agnostic).
        """
        keys = jrandom.split(key, 10)

        # Encoder block 1: 16 → 64
        self.enc1_conv = eqx.nn.Conv2d(16, 64, kernel_size=3, padding=1, key=keys[0])

        # Encoder block 2: 64 → 128
        self.enc2_conv = eqx.nn.Conv2d(64, 128, kernel_size=3, padding=1, key=keys[1])

        # Bottleneck: 128 → 256
        self.bot_conv = eqx.nn.Conv2d(128, 256, kernel_size=3, padding=1, key=keys[2])

        # Decoder block 2: 256 → 128, cat with skip_2 → 256 → 128
        self.dec2_up_conv = eqx.nn.Conv2d(256, 128, kernel_size=1, key=keys[3])
        self.dec2_conv = eqx.nn.Conv2d(256, 128, kernel_size=3, padding=1, key=keys[4])

        # Decoder block 1: 128 → 64, cat with skip_1 → 128 → 64
        self.dec1_up_conv = eqx.nn.Conv2d(128, 64, kernel_size=1, key=keys[5])
        self.dec1_conv = eqx.nn.Conv2d(128, 64, kernel_size=3, padding=1, key=keys[6])

        # Policy head: 64 → 9
        self.policy_conv = eqx.nn.Conv2d(64, 9, kernel_size=1, key=keys[7])

        # Value head: adaptive pool → FC
        self.value_pool = eqx.nn.AdaptiveAvgPool2d((2, 2))
        self.value_fc1 = eqx.nn.Linear(256 * 4, 128, key=keys[8])
        self.value_fc2 = eqx.nn.Linear(128, 1, key=keys[9])

    def _downsample(self, x: jnp.ndarray) -> jnp.ndarray:
        """MaxPool 2x downsampling: (C, H, W) → (C, ceil(H/2), ceil(W/2))."""
        C, H, W = x.shape
        # Pad if odd dimensions
        pad_h = H % 2
        pad_w = W % 2
        if pad_h or pad_w:
            x = jnp.pad(x, ((0, 0), (0, pad_h), (0, pad_w)), mode="constant", constant_values=-jnp.inf)
            H_new, W_new = H + pad_h, W + pad_w
        else:
            H_new, W_new = H, W
        x = x.reshape(C, H_new // 2, 2, W_new // 2, 2)
        return x.max(axis=(2, 4))

    def _upsample(self, x: jnp.ndarray, target_h: int, target_w: int) -> jnp.ndarray:
        """Bilinear 2x upsampling to target size."""
        return jax.image.resize(x, (x.shape[0], target_h, target_w), method="bilinear")

    def _unet_forward(self, obs: jnp.ndarray) -> Tuple[jnp.ndarray, jnp.ndarray]:
        """
        Run U-Net encoder-decoder.

        Args:
            obs: (16, H, W) input tensor.

        Returns:
            features: (64, H, W) decoder output for policy head.
            value_input: (1024,) bottleneck pooled for value head.
        """
        C_in, H, W = obs.shape

        # Encoder block 1
        skip1 = jax.nn.relu(self.enc1_conv(obs))      # (64, H, W)
        pool1 = self._downsample(skip1)                # (64, H//2, W//2)

        # Encoder block 2
        skip2 = jax.nn.relu(self.enc2_conv(pool1))     # (128, H//2, W//2)
        pool2 = self._downsample(skip2)                # (128, H//4, W//4)

        # Bottleneck
        bot = jax.nn.relu(self.bot_conv(pool2))        # (256, H//4, W//4)

        # Value head input from bottleneck
        value_pooled = self.value_pool(bot).reshape(-1) # (256*4,)

        # Decoder block 2
        up2 = self._upsample(self.dec2_up_conv(bot), skip2.shape[1], skip2.shape[2])
        cat2 = jnp.concatenate([up2, skip2], axis=0)   # (256, H//2, W//2)
        dec2 = jax.nn.relu(self.dec2_conv(cat2))       # (128, H//2, W//2)

        # Decoder block 1
        up1 = self._upsample(self.dec1_up_conv(dec2), skip1.shape[1], skip1.shape[2])
        cat1 = jnp.concatenate([up1, skip1], axis=0)   # (128, H, W)
        features = jax.nn.relu(self.dec1_conv(cat1))   # (64, H, W)

        return features, value_pooled

    def _apply_policy_mask(
        self, logits: jnp.ndarray, mask: jnp.ndarray
    ) -> jnp.ndarray:
        """
        Apply valid move mask to logits and return flat logits.

        Args:
            logits: (9, H, W) raw policy logits.
            mask: (H, W, 4) valid move mask.

        Returns:
            logits_flat: (9 * H * W,) masked logits.
        """
        H, W = mask.shape[0], mask.shape[1]
        mask_t = jnp.transpose(mask, (2, 0, 1))  # (4, H, W)
        mask_penalty = (1 - mask_t) * -1e9
        combined_mask = jnp.concatenate([
            mask_penalty,  # 4 directions
            mask_penalty,  # 4 split-move directions
            jnp.zeros((1, H, W)),  # pass action
        ], axis=0)
        return (logits + combined_mask).reshape(-1)

    def _sample_action(
        self, logits_flat: jnp.ndarray, H: int, W: int, key: jnp.ndarray,
    ) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray]:
        """Sample action from flat logits. Returns (action, logprob, entropy)."""
        grid_cells = H * W
        idx = jrandom.categorical(key, logits_flat)
        direction = idx // grid_cells
        position = idx % grid_cells
        row = position // W
        col = position % W
        is_pass = direction == 8
        is_half = (direction >= 4) & (direction < 8)
        actual_dir = jnp.where(is_pass, 0, jnp.where(is_half, direction - 4, direction))
        action = jnp.array([is_pass, row, col, actual_dir, is_half], dtype=jnp.int32)

        log_probs = jax.nn.log_softmax(logits_flat)
        logprob = log_probs[idx]
        probs = jax.nn.softmax(logits_flat)
        entropy = -jnp.sum(probs * log_probs)

        return action, logprob, entropy

    def _action_to_idx(self, action: jnp.ndarray, H: int, W: int) -> jnp.ndarray:
        """Convert action array to flat index for logprob lookup."""
        grid_cells = H * W
        is_pass, row, col, direction, is_half = action
        encoded_dir = jnp.where(is_pass > 0, 8, jnp.where(is_half > 0, direction + 4, direction))
        return encoded_dir * grid_cells + row * W + col

    def __call__(
        self,
        obs_16ch: jnp.ndarray,
        mask: jnp.ndarray,
        key: jnp.ndarray,
        action: Optional[jnp.ndarray] = None,
    ) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray]:
        """
        Forward pass for training: returns (action, value, logprob, entropy).

        Args:
            obs_16ch: (16, H, W) observation + memory channels.
            mask: (H, W, 4) valid move mask.
            key: JAX random key for action sampling.
            action: If provided, evaluate this action. Otherwise sample.

        Returns:
            (action, value, logprob, entropy)
        """
        features, value_pooled = self._unet_forward(obs_16ch)

        # Policy head
        logits = self.policy_conv(features)  # (9, H, W)
        H, W = logits.shape[1], logits.shape[2]
        logits_flat = self._apply_policy_mask(logits, mask)

        # Sample or evaluate action
        if action is None:
            action, logprob, entropy = self._sample_action(logits_flat, H, W, key)
        else:
            idx = self._action_to_idx(action, H, W)
            log_probs = jax.nn.log_softmax(logits_flat)
            logprob = log_probs[idx]
            probs = jax.nn.softmax(logits_flat)
            entropy = -jnp.sum(probs * log_probs)

        # Value head
        value_hidden = jax.nn.relu(self.value_fc1(value_pooled))
        value = self.value_fc2(value_hidden)[0]

        return action, value, logprob, entropy

    def inference(
        self,
        obs_16ch: jnp.ndarray,
        mask: jnp.ndarray,
        key: Optional[jnp.ndarray] = None,
    ) -> Tuple[jnp.ndarray, jnp.ndarray]:
        """
        Inference-only forward pass for deployment.

        Args:
            obs_16ch: (16, H, W) observation + memory channels.
            mask: (H, W, 4) valid move mask.
            key: Optional JAX key (defaults to deterministic argmax).

        Returns:
            (action, value)
        """
        features, value_pooled = self._unet_forward(obs_16ch)

        # Policy: argmax for deterministic deployment
        logits = self.policy_conv(features)
        H, W = logits.shape[1], logits.shape[2]
        logits_flat = self._apply_policy_mask(logits, mask)
        idx = jnp.argmax(logits_flat)
        grid_cells = H * W
        direction = idx // grid_cells
        position = idx % grid_cells
        row = position // W
        col = position % W
        is_pass = direction == 8
        is_half = (direction >= 4) & (direction < 8)
        actual_dir = jnp.where(is_pass, 0, jnp.where(is_half, direction - 4, direction))
        action = jnp.array([is_pass, row, col, actual_dir, is_half], dtype=jnp.int32)

        # Value
        value_hidden = jax.nn.relu(self.value_fc1(value_pooled))
        value = self.value_fc2(value_hidden)[0]

        return action, value
