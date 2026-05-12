import type { ISeatReservation } from "@colyseus/sdk/Client";
import type { ICoordinate } from "@generals-plus/engine";
import { useCallback, useEffect, useState } from "react";

import { useGameRoom } from "#/features/game/api/use-game-room";
import { GameApp } from "#/features/game/renderer/game-app";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";

export function GamePage({ reservation }: { reservation: ISeatReservation }) {
  const { room, renderGrid, moveQueue, gameState, sendMove, playerColors } =
    useGameRoom(reservation);

  const [_tick, setTick] = useState(0);
  const [selection, setSelection] = useState<ICoordinate | null>(null);
  // const [moveQueue, setMoveQueue] = useState<MoveIntent[]>([]);

  const handleSelectCell = useCallback((coord: ICoordinate) => {
    setSelection(coord);
  }, []);

  const handleQueueMove = useCallback(
    (direction: MoveDirection) => {
      if (!selection || !room) return;
      const from = selection;
      const to = getTargetCoord({ from, direction });

      setSelection(to);
      // setMoveQueue((prev) => [...prev, newMove]);

      sendMove(from, to);
    },
    [selection, room, sendMove],
  );

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
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!gameState) return <div className="loading">Connecting to Server...</div>;

  if (!renderGrid) return <div className="loading">Loading Game State...</div>;

  return (
    <div className="flex justify-center">
      <GameApp
        grid={renderGrid}
        selection={selection}
        moveQueue={moveQueue}
        onSelectCell={handleSelectCell}
        onQueueMove={handleQueueMove}
        playerColors={playerColors}
      />
    </div>
  );
}
