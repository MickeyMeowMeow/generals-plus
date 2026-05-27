// @vitest-environment jsdom

import { SquareGrid2D, Terrain, Visibility } from "@generals-plus/engine";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameApp } from "#/features/game/renderer/game-app";

vi.mock("@pixi/react", () => ({
  Application: ({ children }: { children: ReactNode }) => (
    <div data-testid="pixi-app">{children}</div>
  ),
}));

vi.mock("pixi.js", () => ({
  Assets: {
    load: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("#/features/game/renderer/map-renderer", () => ({
  MapRenderer: () => <div data-testid="map-renderer" />,
}));

vi.mock("#/features/game/renderer/viewport", () => ({
  Viewport: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderGameApp(overrides: Partial<Parameters<typeof GameApp>[0]> = {}) {
  return render(
    <GameApp
      grid={SquareGrid2D.generate(10, 10, () => ({
        coordinate: { x: 0, y: 0 },
        visibility: Visibility.VISIBLE,
        terrain: Terrain.PLAIN,
        troopCount: null,
        ownerIndex: null,
        siteIndex: null,
        item: null,
      }))}
      selection={null}
      splitMoveSelection={null}
      moveQueue={[]}
      onSelectCell={vi.fn()}
      onArmSplitMove={vi.fn()}
      onQueueMove={vi.fn()}
      onClearMoveQueue={vi.fn()}
      playerColors={new Map()}
      {...overrides}
    />,
  );
}

describe("GameApp keyboard input", () => {
  afterEach(() => {
    cleanup();
  });

  it("clears the move queue when space is pressed", () => {
    const onQueueMove = vi.fn();
    const onClearMoveQueue = vi.fn();

    renderGameApp({ onQueueMove, onClearMoveQueue });

    fireEvent.keyDown(window, { key: " " });

    expect(onClearMoveQueue).toHaveBeenCalledTimes(1);
    expect(onQueueMove).not.toHaveBeenCalled();
  });
});
