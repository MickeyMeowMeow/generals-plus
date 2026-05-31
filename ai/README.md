# Generals Plus — AI Bot & Training

Python bot service and RL training pipeline for Generals Plus.

## Directory Structure

```
ai/
├── bot/                # Bot service (runs alongside the TS server)
│   ├── server.py       # FastAPI WebSocket server (entry point)
│   ├── heuristic.py    # Rule-based heuristic bot
│   ├── ml_bot.py       # ML bot (auto-detects .eqx or .onnx backend)
│   ├── observation.py  # Vision → tensor conversion
│   └── action.py       # Action format conversion
├── sim/                # Game simulation environment
├── train/              # Training pipeline
│   ├── network.py      # U-Net policy-value network
│   ├── train.py        # PPO training
│   └── export_onnx.py  # Export .eqx → .onnx
├── models/             # Trained model checkpoints
│   └── sft_pretrained.eqx
└── tests/
```

## Quick Start

### 1. Install Dependencies

```bash
cd ai/

# Core dependencies — bot service + JAX inference (~2GB)
pip install -e ".[train]"

# Minimal dependencies — bot service only, heuristic bot (~50MB)
pip install -e .
```

### 2. Run Bot Service

```bash
cd ai/

# ML bot with .eqx model (JAX CPU, ~11s warmup then 17ms/tick)
python -m bot.server --model models/sft_pretrained.eqx

# Heuristic bot (no model needed)
python -m bot.server

# Custom host/port
python -m bot.server --model models/sft_pretrained.eqx --host 0.0.0.0 --port 8765
```

The service listens on `ws://localhost:8765/ws` by default.

Startup with `--model` takes ~11 seconds for JAX warmup (model load + JIT compilation).
After warmup, each tick is ~17ms — well within the 200ms budget.

### 3. Configure TS Server

Set the `BOT_SERVICE_URL` environment variable in the TS server:

```bash
# In apps/server/.env
BOT_SERVICE_URL=ws://localhost:8765/ws
```

The TS server exposes `GET /ai/health` which pings the bot service.
The frontend uses this to show a warning when the bot service is unreachable.

## Deployment

### JAX CPU Deployment (recommended for now)

```bash
# On the deployment machine
cd ai/
pip install -e ".[train]"
python -m bot.server --model models/sft_pretrained.eqx
```

Requirements:
- Python ≥ 3.11
- ~2GB disk (JAX + Equinox dependencies)
- CPU only, no GPU needed

Performance (single-core CPU, macOS, Python 3.13):
| Stage | Time |
|-------|------|
| Startup warmup (one-time) | ~18s |
| Per-game model load (warm) | ~27ms |
| Per-tick inference (10×10) | ~23ms |
| Per-tick inference (18×18) | ~19ms |

### ONNX CPU Deployment (planned)

Lighter deployment (~30MB onnxruntime), but blocked by jax2onnx converter
limitations (`jax.image.resize` antialias, `AdaptiveAvgPool2d` non-divisible dims).

See `train/export_onnx.py` for the export script (needs updating for JAX 0.10+).

## Training

### PPO with U-Net

Train a bot using PPO with self-play:

```bash
cd ai/
python -m train.train --grid-size 10 --num-envs 64
```

**Requirements:** `pip install -e ".[train]"`. GPU (CUDA) recommended.

### Architecture

```
Input: (24, H, W) — 9 obs channels + 15 memory channels
  │
  ├─ Encoder Block 1: Conv(24→96, 3×3) + ReLU → skip_1
  ├─ MaxPool(2)
  ├─ Encoder Block 2: Conv(96→192, 3×3) + ReLU → skip_2
  ├─ MaxPool(2)
  │
  ├─ Bottleneck: Conv(192→384, 3×3) + ReLU
  │
  ├─ Upsample + Conv(384→192, 1×1) + Cat(skip_2) → Conv(384→192, 3×3) + ReLU
  ├─ Upsample + Conv(192→96, 1×1) + Cat(skip_1) → Conv(192→96, 3×3) + ReLU
  │
  ├─ Policy head: Conv(96→9, 1×1) → (9, H, W) logits
  └─ Value head: AdaptiveAvgPool(2,2) → FC(1536→128) → FC(128→1)
```

- No LSTM — memory channels (15ch) encode temporal info
- Fully feedforward: single forward pass per frame
- Variable grid sizes (H, W must be divisible by 4)
- 9 actions: 4 cardinal directions + 4 split-move directions + pass

## Communication Protocol

The TS server communicates with the Python bot service via WebSocket JSON messages:

### TS → Python

| Message | Fields |
|---------|--------|
| `start` | `player_id`, `config` |
| `tick` | `player_id`, `tick`, `grid`, `vision`, `owned_land_count`, `owned_army_count`, `scoreboard` |
| `end` | `player_id` |

### Python → TS

| Message | Fields |
|---------|--------|
| `action` | `action: {pass, row, col, direction, split}` |
| `error` | `message` |
