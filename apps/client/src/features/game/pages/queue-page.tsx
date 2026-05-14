import type { GameMode } from "@generals-plus/engine";
import { QueueClientMessage } from "@generals-plus/shared-types";

import { ColorPicker } from "#/components/game/color-picker";
import { Button } from "#/components/ui/button";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useUser } from "#/features/auth/hooks";
import { useQueueRoom } from "#/features/game/api/use-queue-room";
import {
  ErrorPanel,
  LoadingPanel,
  StageCenter,
} from "#/features/game/components/game-stage";
import { RoomPlayerList } from "#/features/game/components/room-controls";
import { GamePage } from "#/features/game/pages/game-page";

function getModeOption(mode: GameMode) {
  return GAME_MODE_OPTIONS.find((option) => option.id === mode);
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
  const { room, queueState, seatReservation, error, isConnecting } =
    useQueueRoom({ gameMode });
  const userId = useUser((user) => user?.id);
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const modeLabel = getModeOption(gameMode)?.label ?? gameMode;

  if (seatReservation) {
    return (
      <GamePage
        reservation={seatReservation}
        source={{ type: "official", onReturn: onLeave }}
      />
    );
  }

  if (error) return <ErrorPanel message={error} />;

  if (isConnecting || !queueState) {
    return <LoadingPanel message="Joining official queue" />;
  }

  const myPlayer = queueState.players.find((p) => p.id === userId);
  const takenColors = queueState.players.map((p) => p.color);

  return (
    <StageCenter>
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-medium">Hello, {displayName}</p>
          <p className="text-sm text-game-text-dim">Mode: {modeLabel}</p>
        </div>

        <div className="grid gap-8 border-t border-game-border pt-8 md:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Color</h2>
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
      </div>
    </StageCenter>
  );
}
