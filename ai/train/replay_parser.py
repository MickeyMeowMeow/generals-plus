"""
Replay parser for generals.io replay data → SFT training data.

Reads the strakammm/generals_io_replays parquet file, re-simulates each game
using our sim/game.py rules (generals-plus engine), and produces (observation,
action, mask) tuples with memory channel tracking.

Saves one .npz file per grid size (e.g., data/sft_18x18.npz) to preserve
map size diversity — no padding. The U-Net network handles variable sizes natively.

Supports parallel processing via threading (--workers N, default 4).

Usage:
    cd ai/
    python -m train.replay_parser --max-games 1000 --workers 4
"""

import argparse
import os
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import cpu_count

import numpy as np
from tqdm import tqdm

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import jax
import jax.numpy as jnp

from sim.types import GameState, Observation
from sim import game
from sim.action import compute_valid_move_mask, DIRECTIONS
from sim.memory import init_memory, update_memory, memory_to_channels, MemoryState


def obs_to_spatial(obs: Observation) -> np.ndarray:
    """Convert Observation to (9, H, W) spatial tensor."""
    return np.stack([
        obs.armies, obs.generals, obs.cities, obs.mountains,
        obs.neutral_cells, obs.owned_cells, obs.opponent_cells,
        obs.fog_cells, obs.structures_in_fog,
    ], axis=0).astype(np.float32)


def flat_to_rc(flat_idx: int, width: int) -> tuple:
    """Convert flat index to (row, col)."""
    return flat_idx // width, flat_idx % width


def move_to_action(start_flat: int, end_flat: int, is_half: int, width: int, height: int):
    """Convert replay move (start_flat, end_flat, is_half) to our action format."""
    sr, sc = flat_to_rc(start_flat, width)
    er, ec = flat_to_rc(end_flat, width)
    dr, dc = er - sr, ec - sc

    if dr == -1 and dc == 0:
        direction = 0
    elif dr == 1 and dc == 0:
        direction = 1
    elif dr == 0 and dc == -1:
        direction = 2
    elif dr == 0 and dc == 1:
        direction = 3
    else:
        return None, False

    action = np.array([0, sr, sc, direction, is_half], dtype=np.int32)
    return action, True


def parse_replay(row: dict) -> list:
    """
    Parse a single replay. Returns list of dicts with obs_24ch, action, mask, grid_size.
    Only keeps winning player's moves. No padding — original grid size preserved.
    """
    W = row["mapWidth"]
    H = row["mapHeight"]

    if H < 4 or W < 4:
        return []

    generals = row["generals"]
    mountains = row["mountains"]
    cities = row["cities"]
    city_armies = row["cityArmies"]
    moves = row["moves"]

    if len(generals) != 2:
        return []

    # Build initial grid
    grid = np.zeros((H, W), dtype=np.int32)
    for m in mountains:
        r, c = flat_to_rc(m, W)
        if 0 <= r < H and 0 <= c < W:
            grid[r, c] = -2
    for i, c in enumerate(cities):
        r, col_c = flat_to_rc(c, W)
        if 0 <= r < H and 0 <= col_c < W:
            army = city_armies[i] if i < len(city_armies) else 40
            grid[r, col_c] = min(army, 50)
    gen0, gen1 = generals[0], generals[1]
    r0, c0 = flat_to_rc(gen0, W)
    r1, c1 = flat_to_rc(gen1, W)
    grid[r0, c0] = 1
    grid[r1, c1] = 2

    grid_jax = jnp.array(grid)
    state = game.create_initial_state(grid_jax)
    mem = [init_memory(H, W), init_memory(H, W)]

    samples = []
    winner = None

    # Group moves by turn
    turn_moves = {}
    for move in moves:
        player, start, end, is_half, turn = move
        if turn not in turn_moves:
            turn_moves[turn] = {}
        turn_moves[turn][player] = (start, end, is_half)

    for turn in sorted(turn_moves.keys()):
        obs_p0 = game.get_observation(state, 0)
        obs_p1 = game.get_observation(state, 1)

        actions = []
        for p in range(2):
            if p in turn_moves[turn]:
                start, end, is_half = turn_moves[turn][p]
                action, valid = move_to_action(start, end, is_half, W, H)
                actions.append(action if valid else np.array([1, 0, 0, 0, 0], dtype=np.int32))
            else:
                actions.append(np.array([1, 0, 0, 0, 0], dtype=np.int32))

        for p in range(2):
            if p not in turn_moves[turn]:
                continue
            obs = obs_p0 if p == 0 else obs_p1
            action = actions[p]
            obs_9ch = obs_to_spatial(obs)
            mem_ch = np.array(memory_to_channels(mem[p]))
            obs_24ch = np.concatenate([obs_9ch, mem_ch], axis=0)
            mask = np.array(compute_valid_move_mask(obs.armies, obs.owned_cells, obs.mountains))
            mem[p] = update_memory(obs, jnp.array(action), mem[p])
            samples.append({"obs_24ch": obs_24ch, "action": action, "mask": mask,
                            "player": p, "grid_size": (H, W)})

        actions_jax = jnp.stack([jnp.array(actions[0]), jnp.array(actions[1])])
        state, info = game.step(state, actions_jax)
        if info.is_done:
            winner = int(info.winner)
            break

    if winner is not None:
        samples = [s for s in samples if s["player"] == winner]
    return samples


def main():
    parser = argparse.ArgumentParser(description="Parse generals.io replays for SFT")
    parser.add_argument("--max-games", type=int, default=0, help="Max games to parse (0=all)")
    parser.add_argument("--output-dir", default="data", help="Output directory for per-size .npz files")
    parser.add_argument("--workers", type=int, default=16,
                        help="Number of parallel threads (default: 16)")
    args = parser.parse_args()

    parquet_path = os.path.expanduser("~/.cache/huggingface/datasets/train-00000-of-00001.parquet")
    print(f"Loading parquet: {parquet_path}")

    import pyarrow.parquet as pq
    table = pq.read_table(parquet_path)
    total_games = table.num_rows
    max_games = args.max_games if args.max_games > 0 else total_games
    print(f"Total games: {total_games}, processing: {max_games}, workers: {args.workers}")

    # Collect per-size groups (thread-safe via GIL for dict operations)
    size_groups = defaultdict(list)
    total_futures = 0
    games_done = 0
    games_ok = 0
    samples_collected = 0
    skipped = 0

    import time
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = []
        for i in range(min(max_games, total_games)):
            row = {col: table[col][i].as_py() for col in table.column_names}
            W, H = row["mapWidth"], row["mapHeight"]
            if H < 4 or W < 4:
                skipped += 1
                continue
            futures.append(executor.submit(parse_replay, row))
        total_futures = len(futures)
        print(f"Submitted {total_futures} games to {args.workers} workers")

        for future in tqdm(as_completed(futures), total=total_futures, desc="Parsing replays"):
            games_done += 1
            try:
                samples = future.result()
            except Exception:
                skipped += 1
                if games_done % 1000 == 0:
                    elapsed = time.time() - t0
                    gps = games_done / elapsed
                    print(f"  [{games_done}/{total_futures}] {gps:.0f} games/s | "
                          f"{samples_collected} samples | {games_ok} ok, {skipped} skip | "
                          f"{len(size_groups)} sizes")
                continue

            if not samples:
                skipped += 1
            else:
                games_ok += 1
                for s in samples:
                    size_groups[s["grid_size"]].append(s)
                samples_collected += len(samples)

            if games_done % 1000 == 0:
                elapsed = time.time() - t0
                gps = games_done / elapsed
                print(f"  [{games_done}/{total_futures}] {gps:.0f} games/s | "
                      f"{samples_collected} samples | {games_ok} ok, {skipped} skip | "
                      f"{len(size_groups)} sizes")

    elapsed = time.time() - t0
    print(f"\nDone: {games_ok} ok, {skipped} skipped / {total_futures} total in {elapsed:.1f}s "
          f"({total_futures/elapsed:.0f} games/s)")
    print(f"Total samples: {samples_collected} across {len(size_groups)} sizes")

    if not size_groups:
        print("No samples collected!")
        return

    # Save one .npz per grid size — no padding
    os.makedirs(args.output_dir, exist_ok=True)
    total_saved = 0

    # Sort by sample count descending
    for (H, W), samples in sorted(size_groups.items(), key=lambda x: -len(x[1])):
        obs_arr = np.stack([s["obs_24ch"] for s in samples])
        action_arr = np.stack([s["action"] for s in samples])
        mask_arr = np.stack([s["mask"] for s in samples])

        fname = f"sft_{H}x{W}.npz"
        fpath = os.path.join(args.output_dir, fname)
        np.savez(fpath, obs=obs_arr, actions=action_arr, masks=mask_arr,
                 grid_h=H, grid_w=W)
        total_saved += len(samples)
        print(f"  {fname}: {len(samples)} samples ({obs_arr.nbytes / 1e6:.1f} MB)")

    print(f"\nTotal saved: {total_saved} samples across {len(size_groups)} grid sizes")
    print(f"Output directory: {args.output_dir}/")


if __name__ == "__main__":
    main()
