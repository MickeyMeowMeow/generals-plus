import type { GameMode } from "@generals-plus/engine";

export interface RatingUpdateInput {
  playerId: string;
  currentRating: number;
  placement: number;
}

export interface RatingUpdateResult {
  playerId: string;
  oldRating: number;
  newRating: number;
  ratingChange: number;
}

const DEFAULT_K = 32;

export function calculateNewRatings(
  inputs: RatingUpdateInput[],
  _mode: GameMode,
  k: number = DEFAULT_K,
): RatingUpdateResult[] {
  const n = inputs.length;
  if (n < 2) {
    return inputs.map((input) => ({
      playerId: input.playerId,
      oldRating: input.currentRating,
      newRating: input.currentRating,
      ratingChange: 0,
    }));
  }

  const results: RatingUpdateResult[] = [];

  for (let i = 0; i < n; i++) {
    const player = inputs[i];
    let totalChange = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const opponent = inputs[j];
      const placementDiff = opponent.placement - player.placement;
      const actualScore = 0.5 + 0.5 * (placementDiff / (n - 1));
      const expectedScore =
        1 / (1 + 10 ** ((opponent.currentRating - player.currentRating) / 400));

      totalChange += k * (actualScore - expectedScore);
    }

    const avgChange = totalChange / (n - 1);
    const newRating = Math.round(player.currentRating + avgChange);

    results.push({
      playerId: player.playerId,
      oldRating: player.currentRating,
      newRating,
      ratingChange: newRating - player.currentRating,
    });
  }

  return results;
}
