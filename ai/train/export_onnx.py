"""
Export a trained UNetPolicyValueNetwork to ONNX format.

The ONNX model takes 16-channel input (9 obs + 7 memory) + mask,
returns action + value. No LSTM state — memory channels encode temporal info.

Usage:
    python -m train.export_onnx --model models/sft_pretrained.eqx --output models/bot.onnx
"""

import argparse
import os
import sys
from pathlib import Path

# Support running as module
_ai_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ai_dir not in sys.path:
    sys.path.insert(0, _ai_dir)

import jax
import jax.numpy as jnp
import jax.random as jrandom
import equinox as eqx

from train.network import UNetPolicyValueNetwork


def export(args):
    key = jrandom.PRNGKey(0)
    key, net_key = jrandom.split(key)
    network = UNetPolicyValueNetwork(net_key, grid_size=args.grid_size)

    if args.model:
        network = eqx.tree_deserialise_leaves(args.model, network)
        print(f"Loaded weights from {args.model}")
    else:
        print("Exporting with random weights (for testing)")

    grid_size = args.grid_size

    # Inputs: obs_24ch (16, H, W) + mask (H, W, 4)
    # Outputs: action (5,) + value (1,)
    def inference_fn(obs_24ch, mask):
        action, value = network.inference(obs_24ch, mask)
        return action, value

    # Create dummy inputs
    obs_24ch = jnp.zeros((24, grid_size, grid_size))
    mask = jnp.zeros((grid_size, grid_size, 4))

    print(f"Exporting to ONNX: grid={grid_size}x{grid_size}, input=24ch + mask (polymorphic)")

    try:
        import tensorflow as tf
        import tf2onnx

        # Polymorphic spatial dims: ONNX model works with any grid size
        tf_fn = jax.experimental.jax2tf.convert(inference_fn, polymorphic_shapes=[
            "(24, h, w)",
            "(h, w, 4)",
        ])

        input_signature = [
            tf.TensorSpec([24, None, None], tf.float32, name="obs"),
            tf.TensorSpec([None, None, 4], tf.float32, name="mask"),
        ]

        tf_fn = tf.function(tf_fn, input_signature=input_signature)

        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)

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
        # Fallback: save as .eqx for JAX deployment
        path = Path(args.output).with_suffix(".eqx")
        path.parent.mkdir(parents=True, exist_ok=True)
        eqx.tree_serialise_leaves(str(path), network)
        print(f"Saved as JAX-native model: {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument("--model", default=None, help="Path to trained .eqx model")
    parser.add_argument("--output", default="models/bot.onnx", help="Output ONNX path")
    parser.add_argument("--grid-size", type=int, default=18, help="Grid size")
    export(parser.parse_args())
