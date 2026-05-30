#!/bin/bash
# Generals Plus AI Training Pipeline
# 3-phase curriculum on single A800 GPU (~20h total)
#
# Phase 1 (2h):  Behavior cloning on generals.io replay data (SFT)
# Phase 2 (6h):  RL vs random opponent → learn basic movement & expansion
# Phase 3 (12h): Self-play with opponent pool (N=3, 45% gate) → competitive

set -e
cd "$(dirname "$0")"

GRID_SIZE=18
NUM_ENVS=2048
NUM_STEPS=256
MINIBATCH=2048
LR=3e-4

echo "=== Generals Plus AI Training Pipeline ==="
echo "Grid: ${GRID_SIZE}x${GRID_SIZE}"
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
echo ""

# Phase 1: Parse replays & behavior cloning (SFT)
echo "=== Phase 1: SFT Pre-training (~2h) ==="
if [ ! -f "data/sft_dataset_full.npz" ]; then
    echo "Parsing full replay dataset..."
    python3 -m train.replay_parser --output data/sft_dataset_full.npz
fi

echo "Running behavior cloning..."
python3 -m train.pretrain \
    --data data/sft_dataset_full.npz \
    --epochs 50 \
    --lr 1e-3 \
    --batch-size 512 \
    --save-path models/sft_pretrained.eqx

echo "SFT complete. Model saved to models/sft_pretrained.eqx"
echo ""

# Phase 2: RL vs random opponent
echo "=== Phase 2: RL vs Random (~6h) ==="
python3 -m train.train \
    --grid-size $GRID_SIZE \
    --num-envs $NUM_ENVS \
    --num-steps $NUM_STEPS \
    --num-iterations 300 \
    --lr $LR \
    --minibatch-size $MINIBATCH \
    --opponent random \
    --load-path models/sft_pretrained.eqx \
    --save-path models/ppo_phase2.eqx

echo "Phase 2 complete."
echo ""

# Phase 3: Self-play with opponent pool
echo "=== Phase 3: Self-play (~12h) ==="
python3 -m train.train \
    --grid-size $GRID_SIZE \
    --num-envs $NUM_ENVS \
    --num-steps $NUM_STEPS \
    --num-iterations 600 \
    --lr $LR \
    --minibatch-size $MINIBATCH \
    --opponent self-play \
    --pool-size 3 \
    --load-path models/ppo_phase2.eqx \
    --save-path models/ppo_final.eqx

echo "Phase 3 complete."
echo ""

# Export final model
echo "=== Exporting final model ==="
python3 -m train.export_onnx \
    --model models/ppo_final.eqx \
    --output models/bot.onnx \
    --grid-size $GRID_SIZE

echo ""
echo "=== Training pipeline complete! ==="
echo "Final model: models/ppo_final.eqx"
echo "ONNX model:  models/bot.onnx"
