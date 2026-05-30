"""
Replay parser for generals.io replay data → SFT training data.

Reads the strakammm/generals_io_replays parquet file, re-simulates each game
using our sim/game.py rules (generals-plus engine), and produces (observation,
action, mask) tuples with memory channel tracking.

Key challenge: generals.io and generals-plus have different army increment timing.
We re-simulate with OUR rules but use the human players' move decisions.
This is valid because the strategic patterns (expansion, city capture, general
hunting) transfer across rule variants.

Replay data fields:
  - mapWidth, mapHeight: grid dimensions (mostly 18x18)
  - generals: [flat_idx_p0, flat_idx_p1]
  - mountains: [flat_idx, ...]
  - cities: [flat_idx, ...]
  - cityArmies: [initial_army, ...]
  - moves: [[player, start_flat, end_flat, is_half, turn], ...]

Output: data/sft_dataset.npz with arrays suitable for behavior cloning.

Usage:
    cd training/
    python -m rl.replay_parser --max-games 1000
"""

import argparse
import os
import sys

import numpy as np

# Ensure sim module is importable
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
        obs.armies,
        obs.generals,
        obs.cities,
        obs.mountains,
        obs.neutral_cells,
        obs.owned_cells,
        obs.opponent_cells,
        obs.fog_cells,
        obs.structures_in_fog,
    ], axis=0).astype(np.float32)


def flat_to_rc(flat_idx: int, width: int) -> tuple:
    """Convert flat index to (row, col)."""
    return flat_idx // width, flat_idx % width


def move_to_action(start_flat: int, end_flat: int, is_half: int, width: int, height: int):
    """
    Convert replay move (start_flat, end_flat, is_half) to our action format.

    Returns: (action_array, is_valid)
        action_array: [pass, row, col, direction, split] or None if invalid
        is_valid: bool
    """
    sr, sc = flat_to_rc(start_flat, width)
    er, ec = flat_to_rc(end_flat, width)

    dr, dc = er - sr, ec - sc

    # Determine direction
    if dr == -1 and dc == 0:
        direction = 0  # UP
    elif dr == 1 and dc == 0:
        direction = 1  # DOWN
    elif dr == 0 and dc == -1:
        direction = 2  # LEFT
    elif dr == 0 and dc == 1:
        direction = 3  # RIGHT
    else:
        # Non-adjacent move (shouldn't happen in valid replays, but skip)
        return None, False

    action = np.array([0, sr, sc, direction, is_half], dtype=np.int32)
    return action, True


def parse_replay(row: dict) -> list:
    """
    Parse a single replay row into (obs_16ch, action, mask, is_winner) tuples.

    Re-simulates the game using our sim/game.py rules, tracking memory state.

    Returns list of dicts with keys:
        obs_16ch: (16, H, W) observation + memory channels
        action: (5,) [pass, row, col, direction, split]
        mask: (H, W, 4) valid move mask
    """
    W = row["mapWidth"]
    H = row["mapHeight"]

    # Skip games that are too small (need at least 4x4 for U-Net pooling)
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

    # Mountains
    for m in mountains:
        r, c = flat_to_rc(m, W)
        if 0 <= r < H and 0 <= c < W:
            grid[r, c] = -2

    # Cities (with army values 40-50, cap at reasonable range)
    for i, c in enumerate(cities):
        r, col_c = flat_to_rc(c, W)
        if 0 <= r < H and 0 <= col_c < W:
            army = city_armies[i] if i < len(city_armies) else 40
            grid[r, col_c] = min(army, 50)

    # Generals
    gen0 = generals[0]
    gen1 = generals[1]
    r0, c0 = flat_to_rc(gen0, W)
    r1, c1 = flat_to_rc(gen1, W)
    grid[r0, c0] = 1
    grid[r1, c1] = 2

    # Create initial state
    grid_jax = jnp.array(grid)
    state = game.create_initial_state(grid_jax)

    # Initialize memory for both players
    mem = [init_memory(H, W), init_memory(H, W)]

    # Determine winner (player who made the last capture move, or infer from game end)
    # We'll track who won during simulation
    samples = []
    winner = None  # will be determined during re-sim

    # Group moves by turn
    # Replay moves are interleaved: [player, start, end, is_half, turn]
    # Both players may move in the same turn
    turn_moves = {}
    for move in moves:
        player, start, end, is_half, turn = move
        if turn not in turn_moves:
            turn_moves[turn] = {}
        turn_moves[turn][player] = (start, end, is_half)

    # Determine winner: the player whose general gets captured
    # We'll re-simulate and detect general capture
    prev_state = state
    for turn in sorted(turn_moves.keys()):
        # Get observations BEFORE step for both players
        obs_p0 = game.get_observation(state, 0)
        obs_p1 = game.get_observation(state, 1)

        # Build actions for both players
        actions = []
        for p in range(2):
            if p in turn_moves[turn]:
                start, end, is_half = turn_moves[turn][p]
                action, valid = move_to_action(start, end, is_half, W, H)
                if valid:
                    actions.append(action)
                else:
                    actions.append(np.array([1, 0, 0, 0, 0], dtype=np.int32))  # pass
            else:
                actions.append(np.array([1, 0, 0, 0, 0], dtype=np.int32))  # pass

        # Record sample for each player that moved
        for p in range(2):
            if p not in turn_moves[turn]:
                continue

            obs = obs_p0 if p == 0 else obs_p1
            action = actions[p]

            # Build 16ch input
            obs_9ch = obs_to_spatial(obs)
            mem_ch = np.array(memory_to_channels(mem[p]))
            obs_16ch = np.concatenate([obs_9ch, mem_ch], axis=0)  # (16, H, W)

            # Valid move mask
            mask = np.array(compute_valid_move_mask(
                obs.armies, obs.owned_cells, obs.mountains
            ))  # (H, W, 4)

            # Update memory
            mem[p] = update_memory(obs, jnp.array(action), mem[p])

            samples.append({
                "obs_16ch": obs_16ch,
                "action": action,
                "mask": mask,
                "player": p,
            })

        # Step game with our rules
        actions_jax = jnp.stack([jnp.array(actions[0]), jnp.array(actions[1])])
        state, info = game.step(state, actions_jax)

        # Check if game ended — determine winner
        if info.is_done:
            winner = int(info.winner)
            break

    # Only keep winning player's moves
    if winner is not None:
        samples = [s for s in samples if s["player"] == winner]

    return samples


def main():
    parser = argparse.ArgumentParser(description="Parse generals.io replays for SFT")
    parser.add_argument("--max-games", type=int, default=0, help="Max games to parse (0=all)")
    parser.add_argument("--output", default="data/sft_dataset.npz", help="Output .npz path")
    parser.add_argument("--target-size", type=int, nargs=2, default=None,
                        help="Target (H W) to pad to. Default: auto-detect max.")
    args = parser.parse_args()

    parquet_path = os.path.expanduser("~/.cache/huggingface/datasets/train-00000-of-00001.parquet")
    print(f"Loading parquet: {parquet_path}")

    import pyarrow.parquet as pq
    table = pq.read_table(parquet_path)
    total_games = table.num_rows
    max_games = args.max_games if args.max_games > 0 else total_games
    print(f"Total games: {total_games}, processing: {max_games}")

    # Collect per-size groups
    size_groups = {}  # (H, W) -> list of samples
    games_processed = 0
    samples_collected = 0
    skipped = 0

    for i in range(min(max_games, total_games)):
        row = {col: table[col][i].as_py() for col in table.column_names}

        W, H = row["mapWidth"], row["mapHeight"]
        if H < 4 or W < 4:
            skipped += 1
            continue

        try:
            samples = parse_replay(row)
        except Exception as e:
            skipped += 1
            continue

        if not samples:
            skipped += 1
            continue

        key = (H, W)
        if key not in size_groups:
            size_groups[key] = []
        size_groups[key].extend(samples)

        games_processed += 1
        samples_collected += len(samples)

        if games_processed % 500 == 0:
            print(f"  {games_processed} games, {samples_collected} samples, {skipped} skipped")

    print(f"\nDone: {games_processed} games, {samples_collected} samples, {skipped} skipped")

    if not size_groups:
        print("No samples collected!")
        return

    # Find the most common size and filter to that
    best_size = max(size_groups.keys(), key=lambda k: len(size_groups[k]))
    best_samples = size_groups[best_size]
    print(f"\nMost common grid size: {best_size[0]}x{best_size[1]} with {len(best_samples)} samples")

    # Optionally pad smaller sizes to best_size
    target_h, target_w = args.target_size or best_size

    all_obs = []
    all_actions = []
    all_masks = []

    def pad_sample(obs, mask, target_h, target_w):
        """Pad obs and mask to target size. Padded cells become mountains (impassable)."""
        oh, ow = obs.shape[1], obs.shape[2]
        if oh == target_h and ow == target_w:
            return obs, mask
        # Obs channels: 0=armies, 1=generals, 2=cities, 3=mountains,
        #               4=neutral, 5=owned, 6=opponent, 7=fog, 8=struct_fog,
        #               9-15=memory channels
        # Set channel 3 (mountains)=1 for padded cells, rest stay 0
        padded_obs = np.zeros((16, target_h, target_w), dtype=np.float32)
        padded_obs[:, :oh, :ow] = obs
        # Mark padded cells as mountains
        padded_obs[3, oh:, :] = 1.0  # bottom pad rows
        padded_obs[3, :oh, ow:] = 1.0  # right pad cols
        # Mask: zeros for padded area (no valid moves from mountains)
        padded_mask = np.zeros((target_h, target_w, 4), dtype=np.float32)
        padded_mask[:oh, :ow, :] = mask
        return padded_obs, padded_mask

    for s in best_samples:
        obs, mask = pad_sample(s["obs_16ch"], s["mask"], target_h, target_w)
        all_obs.append(obs)
        all_masks.append(mask)
        all_actions.append(s["action"])

    # Also include other-size samples, padded
    for (h, w), samples in size_groups.items():
        if (h, w) == best_size:
            continue
        if h > target_h or w > target_w:
            continue
        for s in samples:
            obs, mask = pad_sample(s["obs_16ch"], s["mask"], target_h, target_w)
            all_obs.append(obs)
            all_masks.append(mask)
            all_actions.append(s["action"])

    # Stack and save
    obs_arr = np.stack(all_obs)
    action_arr = np.stack(all_actions)
    mask_arr = np.stack(all_masks)

    print(f"obs shape: {obs_arr.shape}")
    print(f"action shape: {action_arr.shape}")
    print(f"mask shape: {mask_arr.shape}")

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    np.savez(args.output, obs=obs_arr, actions=action_arr, masks=mask_arr,
             grid_h=target_h, grid_w=target_w)
    print(f"Saved to: {args.output}")


if __name__ == "__main__":
    main()
