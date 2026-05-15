import { GameMode } from "@generals-plus/engine";
import { describe, expect, it } from "vitest";

import { calculateNewRatings } from "#/features/rating/rating-service";

describe("calculateNewRatings", () => {
  it("returns no change for a single player", () => {
    const result = calculateNewRatings(
      [{ playerId: "p1", currentRating: 1000, placement: 1 }],
      GameMode.CLASSIC,
    );

    expect(result).toHaveLength(1);
    expect(result[0].ratingChange).toBe(0);
  });

  it("updates ratings for two players correctly", () => {
    const result = calculateNewRatings(
      [
        { playerId: "p1", currentRating: 1000, placement: 1 },
        { playerId: "p2", currentRating: 1000, placement: 2 },
      ],
      GameMode.CLASSIC,
    );

    expect(result).toHaveLength(2);

    const winner = result.find((r) => r.playerId === "p1")!;
    const loser = result.find((r) => r.playerId === "p2")!;

    expect(winner.newRating).toBeGreaterThan(winner.oldRating);
    expect(loser.newRating).toBeLessThan(loser.oldRating);
    expect(winner.ratingChange).toBe(-loser.ratingChange);
  });

  it("higher rated player gains less for beating lower rated player", () => {
    const result = calculateNewRatings(
      [
        { playerId: "strong", currentRating: 1500, placement: 1 },
        { playerId: "weak", currentRating: 1000, placement: 2 },
      ],
      GameMode.CLASSIC,
    );

    const winner = result.find((r) => r.playerId === "strong")!;
    expect(winner.ratingChange).toBeGreaterThan(0);
    expect(winner.ratingChange).toBeLessThan(16);
  });

  it("lower rated player gains more for beating higher rated player", () => {
    const result = calculateNewRatings(
      [
        { playerId: "weak", currentRating: 1000, placement: 1 },
        { playerId: "strong", currentRating: 1500, placement: 2 },
      ],
      GameMode.CLASSIC,
    );

    const winner = result.find((r) => r.playerId === "weak")!;
    expect(winner.ratingChange).toBeGreaterThan(16);
  });

  it("handles multiple players with different ratings", () => {
    const result = calculateNewRatings(
      [
        { playerId: "p1", currentRating: 1200, placement: 1 },
        { playerId: "p2", currentRating: 1100, placement: 2 },
        { playerId: "p3", currentRating: 1000, placement: 3 },
        { playerId: "p4", currentRating: 900, placement: 4 },
      ],
      GameMode.CLASSIC,
    );

    expect(result).toHaveLength(4);

    const winner = result.find((r) => r.playerId === "p1")!;
    const lastPlace = result.find((r) => r.playerId === "p4")!;

    expect(winner.newRating).toBeGreaterThan(winner.oldRating);
    expect(lastPlace.newRating).toBeLessThan(lastPlace.oldRating);
  });

  it("rating changes are bounded for equal-rated players", () => {
    const result = calculateNewRatings(
      [
        { playerId: "p1", currentRating: 1000, placement: 1 },
        { playerId: "p2", currentRating: 1000, placement: 2 },
        { playerId: "p3", currentRating: 1000, placement: 3 },
      ],
      GameMode.CLASSIC,
    );

    for (const r of result) {
      expect(Math.abs(r.ratingChange)).toBeLessThanOrEqual(32);
    }
  });
});
