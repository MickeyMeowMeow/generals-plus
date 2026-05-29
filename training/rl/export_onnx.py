"""
Export a trained RecurrentPolicyValueNetwork to ONNX format.

The ONNX model separates CNN spatial processing and LSTM recurrence into
two sub-graphs so the inference engine can:
  1. Run CNN on each new spatial frame
  2. Feed (cnn_features, scalar_features) + previous LSTM state into the LSTM step
  3. Read the policy logits and value from the outputs

Usage:
    python -m rl.export_onnx --model models/ppo_recurrent.eqx --output models/bot.onnx
"""

import argparse
from pathlib import Path
import sys

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx

_repo_root = str(Path(__file__).resolve().parents[2])
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from rl.network import RecurrentPolicyValueNetwork


def export(args):
    key = jrandom.PRNGKey(0)
    key, net_key = jrandom.split(key)
    network = RecurrentPolicyValueNetwork(net_key, grid_size=args.grid_size)

    if args.model:
        network = eqx.tree_deserialise_leaves(args.model, network)
        print(f"Loaded weights from {args.model}")
    else:
        print("Exporting with random weights (for testing)")

    grid_size = args.grid_size
    stack_size = args.stack_size
    hidden_dim = network.lstm_cell.hidden_size
    scalar_dim = 6  # SCALAR_DIM

    # --- Export the full inference function as a single ONNX graph ---
    # Inputs:
    #   spatial_seq: (stack_size, 9, H, W)
    #   scalar_seq:  (stack_size, scalar_dim)
    #   h_prev:      (hidden_dim,)
    #   c_prev:      (hidden_dim,)
    #   mask:        (H, W, 4)
    #
    # Outputs:
    #   action:      (5,) — [pass, row, col, direction, split]
    #   h_new:       (hidden_dim,)
    #   c_new:       (hidden_dim,)

    def inference_fn(spatial_seq, scalar_seq, h_prev, c_prev, mask):
        return network.inference(
            spatial_seq, scalar_seq, (h_prev, c_prev), mask, jrandom.PRNGKey(0),
        )

    # Create dummy inputs
    spatial_seq = jnp.zeros((stack_size, 9, grid_size, grid_size))
    scalar_seq = jnp.zeros((stack_size, scalar_dim))
    h_prev = jnp.zeros(hidden_dim)
    c_prev = jnp.zeros(hidden_dim)
    mask = jnp.zeros((grid_size, grid_size, 4))

    # Lower and export
    print(f"Exporting to ONNX: grid={grid_size}x{grid_size}, stack={stack_size}, hidden={hidden_dim}")

    model = eqx.Module
    try:
        import jax.experimental.export as export

        exported = export.export(jax.jit(inference_fn))(
            spatial_seq, scalar_seq, h_prev, c_prev, mask,
        )
        print(f"Exported successfully")
        print(f"  Inputs:  {exported.in_tree}")
        print(f"  Outputs: {exported.out_tree}")

        # Save using the StableHLO serialization (can be converted to ONNX)
        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)

        # Use jax2tf for ONNX conversion
        import tensorflow as tf
        import tf2onnx

        tf_fn = jax.experimental.jax2tf.convert(inference_fn, polymorphic_shapes=[
            f"({stack_size}, 9, {grid_size}, {grid_size})",
            f"({stack_size}, {scalar_dim})",
            f"({hidden_dim},)",
            f"({hidden_dim},)",
            f"({grid_size}, {grid_size}, 4)",
        ])

        # Create TF concrete function
        input_signature = [
            tf.TensorSpec([stack_size, 9, grid_size, grid_size], tf.float32),
            tf.TensorSpec([stack_size, scalar_dim], tf.float32),
            tf.TensorSpec([hidden_dim], tf.float32),
            tf.TensorSpec([hidden_dim], tf.float32),
            tf.TensorSpec([grid_size, grid_size, 4], tf.float32),
        ]

        tf_fn = tf.function(tf_fn, input_signature=input_signature)

        model_onnx, _ = tf2onnx.convert.from_function(
            tf_fn,
            input_signature=input_signature,
            opset=13,
            output_path=str(path),
        )
        print(f"ONNX model saved to: {path}")

    except ImportError as e:
        print(f"\nNote: ONNX export requires tensorflow and tf2onnx.")
        print(f"  pip install tensorflow tf2onnx onnxruntime")
        print(f"  Missing: {e}")
        print()
        # Fallback: save as .eqx (JAX-native) for deployment with JAX CPU
        path = Path(args.output).with_suffix(".eqx")
        path.parent.mkdir(parents=True, exist_ok=True)
        eqx.tree_serialise_leaves(str(path), network)
        print(f"Saved as JAX-native model: {path}")
        print(f"(Install tensorflow + tf2onnx for ONNX export)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument("--model", default=None, help="Path to trained .eqx model")
    parser.add_argument("--output", default="models/bot.onnx", help="Output ONNX path")
    parser.add_argument("--grid-size", type=int, default=10, help="Grid size")
    parser.add_argument("--stack-size", type=int, default=8, help="Observation history length")
    export(parser.parse_args())
