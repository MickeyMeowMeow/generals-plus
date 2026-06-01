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
  it("renders scoreboard values through AnimatedNumber without wrapping labels", () => {
    render(
      <MotionProvider preferenceMode="full">
        <GameHud scoreboard={createClassicScoreboard()} />
      </MotionProvider>,
    );

    expect(
      screen.getByText("Nova").closest("[data-animated-number='true']"),
    ).toBeNull();
    expect(
      screen.getByLabelText("4").closest("[data-animated-number='true']"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("12").closest("[data-animated-number='true']"),
    ).toBeTruthy();
  });
});
