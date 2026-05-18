import type { GameMode } from "@generals-plus/engine";
import { QueueClientMessage } from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useUser } from "#/features/auth/hooks";
import { useQueueRoom } from "#/features/game/api/use-queue-room";
import { ColorPicker } from "#/features/game/components/color-picker";
import { RoomPlayerList } from "#/features/game/components/room-controls";
import { GamePage } from "#/features/game/pages/game-page";
import { RoomStatus } from "#/infra/network/room";

function getModeOption(mode: GameMode) {
  return GAME_MODE_OPTIONS.find((option) => option.id === mode);
}

function formatQueueDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Official queue scene inside the root route.
 *
 * The scene owns the queue-room hook while it is mounted. Color selection sends
 * queue protocol messages, and receipt of a seat reservation swaps the scene
 * directly into `GamePage` without changing the URL.
 */
export function QueuePage({
  gameMode,
  onLeave,
}: {
  gameMode: GameMode;
  onLeave: () => void;
}) {
  const { room, queueState, seatReservation, error, isConnecting, status } =
    useQueueRoom({ gameMode });
  const userId = useUser((user) => user?.id);
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const modeLabel = getModeOption(gameMode)?.label ?? gameMode;
  const [queueSeconds, setQueueSeconds] = useState(0);

  useEffect(() => {
    if (isConnecting || !queueState || seatReservation) {
      setQueueSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setQueueSeconds((seconds) => seconds + 1);
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isConnecting, queueState, seatReservation]);

  useEffect(() => {
    if (!status || seatReservation) return;
    if (
      status === RoomStatus.DISCONNECTED ||
      status === RoomStatus.RECONNECTING ||
      status === RoomStatus.ERROR
    ) {
      onLeave();
    }
  }, [onLeave, seatReservation, status]);

  if (seatReservation) {
    /**
     * Seat reservations are consumed by `GamePage`, which then persists a
     * recovery token for refresh-safe official matches.
     */
    return (
      <GamePage
        connection={{ type: "reservation", reservation: seatReservation }}
        source={{ type: "official", onReturn: onLeave }}
      />
    );
  }

  if (error) {
    /**
     * Queue connection failures should not strand the root route in queue mode.
     */
    return (
      <StageCenter>
        <ErrorPanel
          message={error}
          action={
            <Button type="button" onClick={onLeave}>
              Return to lobby
            </Button>
          }
        />
      </StageCenter>
    );
  }

  if (isConnecting || !queueState) {
    return (
      <StageCenter>
        <LoadingPanel message="Joining official queue" />
      </StageCenter>
    );
  }

  const myPlayer = queueState.players.find((p) => p.id === userId);
  const takenColors = queueState.players.map((p) => p.color);
  const queueDuration = formatQueueDuration(queueSeconds);

  return (
    <StageCenter>
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-game-text-dim">Hello,</p>
            <p className="text-2xl font-bold">{displayName}</p>
          </div>
          <p className="text-sm text-game-text-dim">Mode: {modeLabel}</p>
        </div>

        <div className="grid gap-8 border-t border-game-border pt-8 md:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Pick Your Color</h2>
            {myPlayer ? (
              <ColorPicker
                takenColors={takenColors}
                currentColor={myPlayer.color}
                onSelect={(color) =>
                  room?.send(QueueClientMessage.PICK_COLOR, { color })
                }
              />
            ) : (
              <p className="text-sm text-game-text-dim">
                Waiting for player assignment.
              </p>
            )}
          </section>

          <div className="space-y-5">
            <RoomPlayerList
              players={queueState.players}
              currentUserId={userId}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={onLeave}
              className="w-full"
            >
              Leave queue
            </Button>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-1">
          <p className="text-center text-2xl font-semibold text-game-text-dim">
            QUEUED
          </p>
          <p className="text-center text-4xl font-semibold tabular-nums text-game-text-dim">
            {queueDuration}
          </p>
        </div>
      </div>
    </StageCenter>
  );
}
