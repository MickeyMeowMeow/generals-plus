import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettlementDialog } from "#/features/game/components/settlement-dialog";
import {
  SettlementDialogKind,
  SettlementText,
} from "#/features/game/utils/settlement";

const WinnerName = "Alpha";

afterEach(() => {
  cleanup();
});

describe("SettlementDialog", () => {
  it("renders eliminated actions", () => {
    render(
      <SettlementDialog
        open={true}
        kind={SettlementDialogKind.ELIMINATED}
        winnerName={null}
        onSpectate={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByText(SettlementText.eliminatedTitle)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: SettlementText.exitAction }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: SettlementText.spectateAction }),
    ).toBeTruthy();
  });

  it("renders only exit action for ended games", () => {
    render(
      <SettlementDialog
        open={true}
        kind={SettlementDialogKind.GAME_ENDED}
        winnerName={WinnerName}
        onSpectate={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByText(SettlementText.gameEndedTitle)).toBeTruthy();
    expect(
      screen.getByText(
        `${SettlementText.winnerDescriptionPrefix}${WinnerName}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: SettlementText.exitAction }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: SettlementText.spectateAction }),
    ).toBeNull();
  });

  it("calls callbacks from explicit actions", async () => {
    const user = userEvent.setup();
    const onSpectate = vi.fn();
    const onExit = vi.fn();

    render(
      <SettlementDialog
        open={true}
        kind={SettlementDialogKind.ELIMINATED}
        winnerName={null}
        onSpectate={onSpectate}
        onExit={onExit}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: SettlementText.spectateAction }),
    );
    await user.click(
      screen.getByRole("button", { name: SettlementText.exitAction }),
    );

    expect(onSpectate).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("uses a transparent overlay instead of blur", () => {
    render(
      <SettlementDialog
        open={true}
        kind={SettlementDialogKind.GAME_ENDED}
        winnerName={WinnerName}
        onSpectate={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay?.className).toContain("bg-transparent");
    expect(overlay?.className).toContain("backdrop-blur-none");
  });
});
