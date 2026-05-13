import type { ISeatReservation } from "@colyseus/sdk/Client";
import type { ICoordinate } from "@generals-plus/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useUser } from "#/features/auth/hooks";
import { useGameRoom } from "#/features/game/api/use-game-room";
import { SettlementDialog } from "#/features/game/components/settlement-dialog";
import { GameApp } from "#/features/game/renderer/game-app";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";
import {
  SettlementPresenter,
  SettlementRoute,
} from "#/features/game/utils/settlement";

const GamePageTickIntervalMs = 1000;

const GamePageText = {
  connecting: "Connecting to Server...",
  loadingGameState: "Loading Game State...",
} as const;

export function GamePage({ reservation }: { reservation: ISeatReservation }) {
  const navigate = useNavigate();
  const currentUserId = useUser((user) => user?.id ?? null);
  const {
    renderGrid,
    moveQueue,
    gameState,
    scoreboard,
    gameResult,
    isEliminated,
    isFinished,
    leaveRoom,
    sendMove,
    playerColors,
  } = useGameRoom(reservation, currentUserId);

  const [_tick, setTick] = useState(0);
  const [selection, setSelection] = useState<ICoordinate | null>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const [hasSeenEliminationPrompt, setHasSeenEliminationPrompt] =
    useState(false);
  // const [moveQueue, setMoveQueue] = useState<MoveIntent[]>([]);

  const dialogKind = SettlementPresenter.resolveDialogKind({
    isEliminated,
    isFinished,
    isSpectating,
    hasSeenEliminationPrompt,
  });
  const winnerName = useMemo(
    () =>
      SettlementPresenter.getWinnerName(
        scoreboard,
        gameResult?.winnerTeamId ?? null,
      ),
    [gameResult, scoreboard],
  );
  const canQueueMove = !isEliminated && !isFinished;

  const handleSelectCell = useCallback((coord: ICoordinate) => {
    setSelection(coord);
  }, []);

  const handleQueueMove = useCallback(
    (direction: MoveDirection) => {
      if (!selection || isEliminated || isFinished) return;
      const from = selection;
      const to = getTargetCoord({ from, direction });

      setSelection(to);
      // setMoveQueue((prev) => [...prev, newMove]);

      sendMove(from, to);
    },
    [isEliminated, isFinished, selection, sendMove],
  );

  const handleSpectate = useCallback(() => {
    setIsSpectating(true);
    setHasSeenEliminationPrompt(true);
  }, []);

  const handleExit = useCallback(() => {
    setIsSpectating(false);
    setHasSeenEliminationPrompt(false);
    void leaveRoom().finally(() => navigate(SettlementRoute.LOBBY));
  }, [leaveRoom, navigate]);

  useEffect(() => {
    if (!isEliminated) {
      setIsSpectating(false);
      setHasSeenEliminationPrompt(false);
    }
  }, [isEliminated]);

  // TODO: Load generator from config
  // const generator = useMemo(() => new DefaultGridGenerator(), []);

  // const grid = useMemo(
  //   () =>
  //     generator.generate({
  //       width: 28,
  //       height: 18,
  //       seed: tick,
  //     }),
  //   [generator, tick],
  // );

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t: number) => t + 1);
    }, GamePageTickIntervalMs);
    return () => clearInterval(id);
  }, []);

  if (!gameState) {
    return <div className="loading">{GamePageText.connecting}</div>;
  }

  if (!renderGrid) {
    return <div className="loading">{GamePageText.loadingGameState}</div>;
  }

  return (
    <div className="flex justify-center">
      <GameApp
        grid={renderGrid}
        selection={selection}
        moveQueue={moveQueue}
        scoreboard={scoreboard}
        canQueueMove={canQueueMove}
        onSelectCell={handleSelectCell}
        onQueueMove={handleQueueMove}
        playerColors={playerColors}
      />
      {dialogKind ? (
        <SettlementDialog
          open={true}
          kind={dialogKind}
          winnerName={winnerName}
          onSpectate={handleSpectate}
          onExit={handleExit}
        />
      ) : null}
    </div>
  );
}
