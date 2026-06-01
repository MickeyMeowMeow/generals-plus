// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoomPlayerList } from "#/features/game/components/room-controls";
import { MotionProvider } from "#/features/motion/motion-provider";

const players = [
  {
    id: "p1",
    displayName: "Nova",
    color: 0x3366ff,
    teamId: "t1",
    isHost: true,
  },
];

describe("RoomPlayerList", () => {
  it("renders display-only counts through AnimatedNumber", () => {
    render(
      <MotionProvider preferenceMode="full">
        <RoomPlayerList
          players={players}
          currentUserId="p1"
          maxPlayers={8}
          showHost
          teamGroups={[
            {
              id: "t1",
              label: "Team t1",
              count: 1,
              capacity: 4,
            },
          ]}
          onJoinTeam={vi.fn()}
        />
      </MotionProvider>,
    );

    expect(
      screen.getByLabelText("1 / 8").closest("[data-animated-number='true']"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("1 / 4").closest("[data-animated-number='true']"),
    ).toBeTruthy();
  });
});
