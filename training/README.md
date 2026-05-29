# Generals Plus — AI Bot & Training

Python bot service and RL training pipeline for Generals Plus.

## Directory Structure

```
training/
├── bot/                # Bot service (runs alongside the TS server)
│   ├── server.py       # FastAPI WebSocket server (entry point)
│   ├── heuristic.py    # Rule-based heuristic bot
│   ├── ml_bot.py       # ML bot (auto-detects .eqx or .onnx backend)
│   ├── observation.py  # Vision → tensor conversion, ObservationBuffer
│   └── action.py       # Action format conversion
├── rl/                 # Reinforcement learning
│   ├── network.py      # CNN + LSTM network architecture
│   ├── train.py        # PPO training pipeline
│   └── export_onnx.py  # Export .eqx → .onnx for CPU deployment
└── tests/
```

## Quick Start

### 1. Install Dependencies

```bash
# Core dependencies — bot service + CPU inference (lightweight, ~50MB)
pip install -e .

# With training support (CUDA JAX, ~2GB+)
pip install -e ".[train]"
```

### 2. Run Bot Service

```bash
# Heuristic bot (no ML model needed)
python -m bot.server

# With a trained model (.onnx — CPU deployment, lightweight)
python -m bot.server --model models/bot.onnx

# With a trained model (.eqx — requires JAX, for dev/training machines)
python -m bot.server --model models/ppo_recurrent.eqx

# Custom host/port
python -m bot.server --host 0.0.0.0 --port 8765
```

The service listens on `ws://localhost:8765/ws` by default.

### 3. Configure TS Server

Set the `BOT_SERVICE_URL` environment variable in the TS server:

```bash
# In apps/server/.env
BOT_SERVICE_URL=ws://localhost:8765/ws
```

The TS server exposes `GET /ai/health` which pings the bot service. The frontend uses this to show a warning when the bot service is unreachable.

## Deployment

### CPU-Only Deployment (recommended for production)

The bot can run on CPU-only machines using the ONNX backend:

1. **Train** on a GPU machine (see Training section below)
2. **Export** the trained model to ONNX:

```bash
# Requires: pip install -e ".[train]"
python -m rl.export_onnx --model models/ppo_recurrent.eqx --output models/bot.onnx
```

3. **Deploy** with only core dependencies:

```bash
# On the deployment machine (no GPU needed)
pip install -e .
python -m bot.server --model models/bot.onnx
```

The ONNX Runtime dependency (`onnxruntime`) is ~30MB and runs efficiently on CPU — well within the 500ms tick budget for 10x10 grids.

### JAX Deployment (for development)

If you have JAX installed (e.g., on the training machine), you can deploy directly with `.eqx` files. JAX will use CPU if no GPU is available.

## Training

### PPO with CNN + LSTM

Train a bot using PPO with self-play in the JAX environment:

```bash
# From the training/ directory
python -m rl.train --grid-size 10 --num-envs 64

# Full options
python -m rl.train \
  --grid-size 10 \
  --num-envs 128 \
  --num-steps 256 \
  --num-iterations 500 \
  --lr 3e-4 \
  --stack-size 4 \
  --minibatch-size 64 \
  --save-path models/ppo_recurrent.eqx
```

**Requirements:** `pip install -e ".[train]"`. GPU (CUDA) recommended.

### Architecture

```
Spatial obs (9, H, W) ──→ CNN ──→ spatial_features
                                        │
Scoreboard scalars ──→ linear proj ────┤
                                        ↓
                                    LSTM (memory across ticks)
                                        │
                              ┌─────────┴─────────┐
                        policy head          value head
                     (action logits)      (state value)
```

- **CNN**: 4-layer conv backbone extracts spatial features from the 9-channel vision grid
- **Scalar projection**: Projects public scoreboard data (troops, land, alive) into the feature space
- **LSTM**: Processes the sequence of (CNN features, scalar features) for temporal memory
- **Policy head**: Uses CNN spatial features with valid-move masking for action selection
- **Value head**: Uses LSTM hidden state for value estimation

### Export to ONNX

After training, export for CPU deployment:

```bash
python -m rl.export_onnx --model models/ppo_recurrent.eqx --output models/bot.onnx

# Requires tensorflow + tf2onnx for ONNX conversion:
pip install -e ".[export]"
```

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

The `scoreboard` field contains public per-player data (same data all players see): `playerId`, `troops`, `land`, `isAlive`.
