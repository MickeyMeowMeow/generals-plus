"""
Behavior cloning (SFT) pre-training on generals.io replay data.

Trains UNetPolicyValueNetwork to imitate expert human moves from
parsed replay data. Supports multiple grid sizes — loads all sft_*.npz
files from the data directory and cycles through them.

No padding needed — the U-Net handles variable grid sizes natively.

Usage:
    cd ai/
    python -m train.pretrain --data-dir data/ --epochs 20 --lr 1e-3 --batch-size 1024
"""

import argparse
import glob
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

# Limit JAX GPU pre-allocation to avoid wasting memory.
# Default is 75% (~60 GB on 80 GB A800). SFT uses far less.
os.environ.setdefault("XLA_PYTHON_CLIENT_MEM_FRACTION", "0.25")

jax.config.update("jax_default_matmul_precision", "bfloat16")

from train.network import UNetPolicyValueNetwork

# Lazy import for optional tqdm
try:
    from tqdm import tqdm as _tqdm
except ImportError:
    _tqdm = None


def load_datasets(data_dir: str) -> list:
    """
    Load all sft_*.npz files from directory.
    Returns list of (obs, actions, masks, H, W, filepath) tuples.
    """
    datasets = []
    pattern = os.path.join(data_dir, "sft_*.npz")
    files = sorted(glob.glob(pattern))

    if not files:
        # Fallback: single file
        single = os.path.join(data_dir, "sft_dataset.npz")
        if os.path.exists(single):
            files = [single]

    for fpath in files:
        data = np.load(fpath, allow_pickle=True)
        obs = data["obs"]
        actions = data["actions"]
        masks = data["masks"]
        H = int(data["grid_h"]) if "grid_h" in data else obs.shape[2]
        W = int(data["grid_w"]) if "grid_w" in data else obs.shape[3]
        datasets.append((obs, actions, masks, H, W, os.path.basename(fpath)))
        print(f"  {os.path.basename(fpath)}: {obs.shape[0]} samples, {H}x{W}")

    return datasets


def action_to_label(action: np.ndarray, H: int, W: int) -> int:
    """Convert action [pass, row, col, direction, split] to flat index."""
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
    """Cross-entropy loss for a single sample."""
    features, _ = network._unet_forward(obs)
    logits = network.policy_conv(features)
    H, W = logits.shape[1], logits.shape[2]

    mask_t = jnp.transpose(mask, (2, 0, 1))
    mask_penalty = (1 - mask_t) * -1e9
    combined_mask = jnp.concatenate([
        mask_penalty, mask_penalty, jnp.zeros((1, H, W)),
    ], axis=0)
    logits_flat = (logits + combined_mask).reshape(-1)

    log_probs = jax.nn.log_softmax(logits_flat)
    return -log_probs[label]


def compute_accuracy(network, obs, mask, label):
    """Prediction accuracy for a single sample."""
    features, _ = network._unet_forward(obs)
    logits = network.policy_conv(features)
    H, W = logits.shape[1], logits.shape[2]

    mask_t = jnp.transpose(mask, (2, 0, 1))
    mask_penalty = (1 - mask_t) * -1e9
    combined_mask = jnp.concatenate([
        mask_penalty, mask_penalty, jnp.zeros((1, H, W)),
    ], axis=0)
    logits_flat = (logits + combined_mask).reshape(-1)

    pred = jnp.argmax(logits_flat)
    return (pred == label).astype(jnp.float32)


def train_step(network, opt_state, obs_batch, mask_batch, label_batch, optimizer):
    """Train on a minibatch (all same grid size within batch)."""
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
    parser.add_argument("--data-dir", default="data", help="Directory with sft_*.npz files")
    parser.add_argument("--data", default=None, help="Single .npz file (overrides --data-dir)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--batch-size", type=int, default=1024, help="Batch size")
    parser.add_argument("--save-path", default="models/sft_pretrained.eqx", help="Model save path")
    parser.add_argument("--eval-every", type=int, default=5, help="Eval every N epochs")
    parser.add_argument("--ch1", type=int, default=96, help="Encoder level-1 channels (default 96)")
    parser.add_argument("--ch2", type=int, default=192, help="Encoder level-2 channels (default 192)")
    parser.add_argument("--ch-bot", type=int, default=384, help="Bottleneck channels (default 384)")
    args = parser.parse_args()

    print(f"JAX devices: {jax.devices()}")

    # Load datasets
    if args.data:
        print(f"Loading single file: {args.data}")
        datasets = []
        data = np.load(args.data, allow_pickle=True)
        obs = data["obs"]
        actions = data["actions"]
        masks = data["masks"]
        H = int(data["grid_h"]) if "grid_h" in data else obs.shape[2]
        W = int(data["grid_w"]) if "grid_w" in data else obs.shape[3]
        datasets.append((obs, actions, masks, H, W, args.data))
        print(f"  {args.data}: {obs.shape[0]} samples, {H}x{W}")
    else:
        print(f"Loading datasets from: {args.data_dir}/")
        datasets = load_datasets(args.data_dir)

    if not datasets:
        print("No datasets found!")
        return

    total_samples = sum(d[0].shape[0] for d in datasets)
    print(f"Total: {total_samples} samples across {len(datasets)} grid sizes")

    # Precompute labels for each dataset
    labeled_datasets = []
    for obs, actions, masks, H, W, name in datasets:
        labels = np.array([action_to_label(a, H, W) for a in actions], dtype=np.int32)
        labeled_datasets.append((obs, actions, masks, labels, H, W, name))

    # Initialize network (grid-size agnostic)
    key = jrandom.PRNGKey(42)
    key, net_key = jrandom.split(key)
    network = UNetPolicyValueNetwork(
        net_key, grid_size=18, ch1=args.ch1, ch2=args.ch2, ch_bot=args.ch_bot,
    )

    params, _ = eqx.partition(network, eqx.is_array)
    print(f"Parameters: {sum(x.size for x in jax.tree.leaves(params)):,}")

    optimizer = optax.chain(
        optax.clip_by_global_norm(1.0),
        optax.adam(args.lr),
    )
    opt_state = optimizer.init(eqx.filter(network, eqx.is_array))

    print(f"Epochs: {args.epochs}, Batch size: {args.batch_size}\n")

    for epoch in range(args.epochs):
        t0 = time.time()
        epoch_loss = 0.0
        epoch_batches = 0

        # Count total batches for progress bar
        total_batches = sum(
            d[0].shape[0] // args.batch_size
            for d in labeled_datasets
            if d[0].shape[0] >= args.batch_size
        )

        pbar = None
        if _tqdm is not None:
            pbar = _tqdm(total=total_batches, desc=f"Epoch {epoch+1}/{args.epochs}", unit="batch")

        # Cycle through all grid sizes each epoch
        for obs_all, _, masks_all, labels_all, H, W, name in labeled_datasets:
            N = obs_all.shape[0]
            num_batches = N // args.batch_size
            if num_batches == 0:
                continue

            # Shuffle within this grid size
            key, shuffle_key = jrandom.split(key)
            perm = jrandom.permutation(shuffle_key, N)
            obs_shuffled = obs_all[np.array(perm)]
            masks_shuffled = masks_all[np.array(perm)]
            labels_shuffled = labels_all[np.array(perm)]

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
                epoch_batches += 1
                if pbar is not None:
                    pbar.update(1)
                    pbar.set_postfix({"loss": f"{float(loss):.4f}", "grid": name.split(".")[0]})

        if pbar is not None:
            pbar.close()

        avg_loss = epoch_loss / max(epoch_batches, 1)
        elapsed = time.time() - t0

        # Evaluate on each grid size
        if (epoch + 1) % args.eval_every == 0 or epoch == 0:
            accs_all = []
            for obs_all, _, masks_all, labels_all, H, W, name in labeled_datasets:
                eval_size = min(500, obs_all.shape[0])
                eval_obs = jnp.array(obs_all[:eval_size])
                eval_masks = jnp.array(masks_all[:eval_size])
                eval_labels = jnp.array(labels_all[:eval_size])
                accs = jax.vmap(compute_accuracy, in_axes=(None, 0, 0, 0))(
                    network, eval_obs, eval_masks, eval_labels,
                )
                acc = float(accs.mean())
                accs_all.append(acc)
                print(f"    {name}: {acc:.2%}")
            overall_acc = np.mean(accs_all)
            print(f"Epoch {epoch:3d} | Loss: {avg_loss:.4f} | Acc: {overall_acc:.2%} | Time: {elapsed:.1f}s")
        else:
            print(f"Epoch {epoch:3d} | Loss: {avg_loss:.4f} | Time: {elapsed:.1f}s")

    # Save
    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)
    eqx.tree_serialise_leaves(args.save_path, network)
    print(f"\nModel saved to: {args.save_path}")


if __name__ == "__main__":
    main()
