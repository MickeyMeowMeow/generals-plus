#!/bin/bash
# Generals Plus AI Training Pipeline
# Single A800-80G, total budget ~18h
#
# Phase 0: Replay parsing  ~7h  (CPU/disk, 64 workers)
# Phase 1: SFT pretrain    ~2h  (GPU)
# Phase 2: RL vs random    ~3h  (GPU, lax.scan + bf16)
# Phase 3: Self-play       ~6h  (GPU, lax.scan + bf16, N=3 pool)

set -e
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
cd "$SCRIPT_DIR"

# --- Logging setup ---
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
PIPELINE_LOG="$LOG_DIR/pipeline_$(date +%Y%m%d_%H%M%S).log"

# Tee all output to log file + stdout
exec > >(tee -a "$PIPELINE_LOG") 2>&1

# --- Budget planning (total ~18h on A800-80G) ---
# Phase 0: Replay parsing  ~7h  (disk/CPU-heavy, 64 workers)
# Phase 1: SFT pretrain    ~2h  (GPU)
# Phase 2: RL vs random    ~3h  (GPU, lax.scan + bf16)
# Phase 3: Self-play       ~6h  (GPU, lax.scan + bf16, N=3 pool)
# Total:                   ~18h

GRID_SIZE=18
NUM_ENVS=2048
NUM_STEPS=256
MINIBATCH=2048
LR=4e-5

PIPELINE_START=$(date +%s)

echo "=== Generals Plus AI Training Pipeline ==="
echo "Started:  $(date '+%Y-%m-%d %H:%M:%S')"
echo "Log file: $PIPELINE_LOG"
echo "Grid: ${GRID_SIZE}x${GRID_SIZE}  |  Total budget: ~18h"
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo 'unknown')"
echo ""

# Phase 0: Replay parsing (~7h)
# Per-turn game steps are tiny — CPU parallel is faster than GPU kernel overhead.
# JAX_PLATFORMS=cpu prevents GPU preallocation, keeps GPU free for training phases.
echo "=== Phase 0: Replay Parsing (~7h) ==="
PHASE_START=$(date +%s)
if [ ! -f "data/sft_18x18.npz" ]; then
    echo "Parsing full replay dataset (64 workers, 128-core CPU)..."
    JAX_PLATFORMS=cpu python3 -m train.replay_parser --output-dir data --max-games 0
else
    echo "SFT data already exists, skipping parse."
fi
PHASE_END=$(date +%s)
echo "Phase 0 done in $(( (PHASE_END - PHASE_START) / 60 ))m $(( (PHASE_END - PHASE_START) % 60 ))s"
echo ""

# Phase 1: Behavior cloning (~2h)
# echo "=== Phase 1: SFT Pre-training (~2h) ==="
# PHASE_START=$(date +%s)
# python3 -m train.pretrain \
#     --data-dir data \
#     --epochs 20 \
#     --lr 1e-3 \
#     --batch-size 1024 \
#     --save-path models/sft_pretrained.eqx
# PHASE_END=$(date +%s)
# echo "Phase 1 done in $(( (PHASE_END - PHASE_START) / 60 ))m $(( (PHASE_END - PHASE_START) % 60 ))s"
# echo ""

# Phase 2: Self-play with opponent pool (~6h, lax.scan + bf16)
echo "=== Phase 2: Self-play (~6h) ==="
PHASE_START=$(date +%s)
XLA_PYTHON_CLIENT_MEM_FRACTION=0.95 python3 -m train.train \
    --grid-size $GRID_SIZE \
    --num-envs $NUM_ENVS \
    --num-steps $NUM_STEPS \
    --num-iterations 1000 \
    --lr $LR \
    --minibatch-size $MINIBATCH \
    --opponent self-play \
    --pool-size 3 \
    --load-path models/sft_pretrained.eqx \
    --save-path models/ppo_final.eqx
PHASE_END=$(date +%s)
echo "Phase 2 done in $(( (PHASE_END - PHASE_START) / 60 ))m $(( (PHASE_END - PHASE_START) % 60 ))s"
echo ""

# Export final model
echo "=== Exporting final model ==="
python3 -m train.export_onnx \
    --model models/ppo_final.eqx \
    --output models/bot.onnx \
    --grid-size $GRID_SIZE

PIPELINE_END=$(date +%s)
TOTAL_MINS=$(( (PIPELINE_END - PIPELINE_START) / 60 ))
echo ""
echo "=== Training pipeline complete! ==="
echo "Finished:  $(date '+%Y-%m-%d %H:%M:%S')"
echo "Total:     ${TOTAL_MINS}m"
echo "Final model: models/ppo_final.eqx"
echo "ONNX model:  models/bot.onnx"
echo "Log file:    $PIPELINE_LOG"
