"""
Behavior cloning (SFT) pre-training on generals.io replay data.

Trains UNetPolicyValueNetwork to imitate expert human moves from
the parsed replay dataset (data/sft_dataset.npz).

Uses cross-entropy loss on action prediction, with valid move masking.

Usage:
    cd training/
    python -m rl.pretrain --epochs 50 --lr 1e-3
"""

import argparse
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx
import optax

from rl.network import UNetPolicyValueNetwork


def load_dataset(path: str):
    """Load SFT dataset from .npz file."""
    data = np.load(path, allow_pickle=True)
    obs = data["obs"]          # (N, 16, H, W)
    actions = data["actions"]  # (N, 5) [pass, row, col, direction, split]
    masks = data["masks"]      # (N, H, W, 4)
    grid_h = int(data["grid_h"]) if "grid_h" in data else obs.shape[2]
    grid_w = int(data["grid_w"]) if "grid_w" in data else obs.shape[3]
    return obs, actions, masks, grid_h, grid_w


def action_to_label(action: np.ndarray, H: int, W: int) -> int:
    """
    Convert action [pass, row, col, direction, split] to flat index.

    Encoding matches network output:
      dirs 0-3: UP/DOWN/LEFT/RIGHT
      dirs 4-7: UP/DOWN/LEFT/RIGHT with split
      dir 8: pass
    """
    is_pass, row, col, direction, is_half = action
    if is_pass:
        encoded_dir = 8
    elif is_half:
        encoded_dir = direction + 4
    else:
        encoded_dir = direction
    return encoded_dir * (H * W) + row * W + col


@eqx.filter_jit
def compute_loss(network, obs, mask, label):
    """
    Compute cross-entropy loss for a single sample.

    Args:
        network: UNetPolicyValueNetwork.
        obs: (16, H, W) observation.
        mask: (H, W, 4) valid move mask.
        label: Flat action index.

    Returns:
        Scalar loss.
    """
    # Run through U-Net to get features
    features, _ = network._unet_forward(obs)

    # Policy head
    logits = network.policy_conv(features)  # (9, H, W)
    H, W = logits.shape[1], logits.shape[2]

    # Apply mask
    mask_t = jnp.transpose(mask, (2, 0, 1))  # (4, H, W)
    mask_penalty = (1 - mask_t) * -1e9
    combined_mask = jnp.concatenate([
        mask_penalty, mask_penalty,
        jnp.zeros((1, H, W)),
    ], axis=0)
    logits_flat = (logits + combined_mask).reshape(-1)

    # Cross-entropy loss
    log_probs = jax.nn.log_softmax(logits_flat)
    loss = -log_probs[label]

    return loss


def compute_accuracy(network, obs, mask, label):
    """Compute prediction accuracy for a single sample."""
    features, _ = network._unet_forward(obs)
    logits = network.policy_conv(features)
    H, W = logits.shape[1], logits.shape[2]

    mask_t = jnp.transpose(mask, (2, 0, 1))
    mask_penalty = (1 - mask_t) * -1e9
    combined_mask = jnp.concatenate([
        mask_penalty, mask_penalty,
        jnp.zeros((1, H, W)),
    ], axis=0)
    logits_flat = (logits + combined_mask).reshape(-1)

    pred = jnp.argmax(logits_flat)
    return (pred == label).astype(jnp.float32)


def train_step(network, opt_state, obs_batch, mask_batch, label_batch, optimizer):
    """Train on a minibatch."""
    def loss_fn(net):
        losses = jax.vmap(compute_loss, in_axes=(None, 0, 0, 0))(
            net, obs_batch, mask_batch, label_batch,
        )
        return jnp.mean(losses)

    loss, grads = eqx.filter_value_and_grad(loss_fn)(network)
    updates, opt_state = optimizer.update(grads, opt_state, network)
    network = eqx.apply_updates(network, updates)

    return network, opt_state, loss


def main():
    parser = argparse.ArgumentParser(description="Behavior cloning pre-training")
    parser.add_argument("--data", default="data/sft_dataset.npz", help="SFT dataset path")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--batch-size", type=int, default=256, help="Batch size")
    parser.add_argument("--save-path", default="models/sft_pretrained.eqx", help="Model save path")
    parser.add_argument("--eval-every", type=int, default=5, help="Eval every N epochs")
    args = parser.parse_args()

    print(f"JAX devices: {jax.devices()}")
    print(f"Loading data from: {args.data}")

    obs_all, actions_all, masks_all, H, W = load_dataset(args.data)
    N = obs_all.shape[0]
    print(f"Dataset: {N} samples, grid: {H}x{W}")

    # Convert actions to labels
    labels_all = np.array([action_to_label(a, H, W) for a in actions_all], dtype=np.int32)

    # Initialize network
    key = jrandom.PRNGKey(42)
    key, net_key = jrandom.split(key)
    network = UNetPolicyValueNetwork(net_key, grid_size=H)

    params, _ = eqx.partition(network, eqx.is_array)
    print(f"Parameters: {sum(x.size for x in jax.tree.leaves(params)):,}")

    optimizer = optax.adam(args.lr)
    opt_state = optimizer.init(eqx.filter(network, eqx.is_array))

    num_batches = N // args.batch_size
    print(f"Epochs: {args.epochs}, Batch size: {args.batch_size}, Batches/epoch: {num_batches}\n")

    for epoch in range(args.epochs):
        t0 = time.time()

        # Shuffle
        key, shuffle_key = jrandom.split(key)
        perm = jrandom.permutation(shuffle_key, N)
        obs_shuffled = obs_all[np.array(perm)]
        masks_shuffled = masks_all[np.array(perm)]
        labels_shuffled = labels_all[np.array(perm)]

        epoch_loss = 0.0
        for i in range(num_batches):
            start = i * args.batch_size
            end = start + args.batch_size
            obs_batch = jnp.array(obs_shuffled[start:end])
            mask_batch = jnp.array(masks_shuffled[start:end])
            label_batch = jnp.array(labels_shuffled[start:end])

            network, opt_state, loss = train_step(
                network, opt_state, obs_batch, mask_batch, label_batch, optimizer,
            )
            epoch_loss += float(loss)

        avg_loss = epoch_loss / max(num_batches, 1)
        elapsed = time.time() - t0

        # Evaluate accuracy
        if (epoch + 1) % args.eval_every == 0 or epoch == 0:
            eval_size = min(1000, N)
            eval_obs = jnp.array(obs_all[:eval_size])
            eval_masks = jnp.array(masks_all[:eval_size])
            eval_labels = jnp.array(labels_all[:eval_size])
            accs = jax.vmap(compute_accuracy, in_axes=(None, 0, 0, 0))(
                network, eval_obs, eval_masks, eval_labels,
            )
            acc = float(accs.mean())
            print(f"Epoch {epoch:3d} | Loss: {avg_loss:.4f} | Acc: {acc:.2%} | Time: {elapsed:.1f}s")
        else:
            print(f"Epoch {epoch:3d} | Loss: {avg_loss:.4f} | Time: {elapsed:.1f}s")

    # Save
    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)
    eqx.tree_serialise_leaves(args.save_path, network)
    print(f"\nModel saved to: {args.save_path}")


if __name__ == "__main__":
    main()
