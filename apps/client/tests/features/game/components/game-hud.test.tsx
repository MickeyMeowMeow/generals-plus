// @vitest-environment jsdom

import { GameMode } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
} from "@generals-plus/shared-types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameHud } from "#/features/game/components/game-hud";
import { MotionProvider } from "#/features/motion/motion-provider";

function createClassicScoreboard() {
  const scoreboard = new ClassicScoreboard();
  scoreboard.mode = GameMode.CLASSIC;

  const player = new ClassicScoreboardPlayerEntry();
  player.playerId = "p1";
  player.teamId = "p1";
  player.displayName = "Nova";
  player.color = 0x3366ff;
  player.isAlive = true;
  player.land = 4;
  player.troops = 12;
  scoreboard.players.push(player);

  return scoreboard;
}

describe("GameHud", () => {
  it("renders scoreboard labels and values as plain text", () => {
    render(
      <MotionProvider preferenceMode="full">
        <GameHud scoreboard={createClassicScoreboard()} />
      </MotionProvider>,
    );

    expect(screen.getByText("Nova")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByLabelText("4")).toBeNull();
    expect(screen.queryByLabelText("12")).toBeNull();
  });
});
