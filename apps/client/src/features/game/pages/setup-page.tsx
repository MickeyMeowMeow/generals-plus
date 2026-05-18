import { SetupClientMessage } from "@generals-plus/shared-types";
import { LogOut, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { useUser } from "#/features/auth/hooks";
import { useSetupRoom } from "#/features/game/api/use-setup-room";
import { ColorPicker } from "#/features/game/components/color-picker";
import { GameSettings } from "#/features/game/components/game-settings";
import { RoomPlayerList } from "#/features/game/components/room-controls";
import { GamePage } from "#/features/game/pages/game-page";
import { networkProvider } from "#/infra/network/provider";

/**
 * Computes how many teams the current setup settings will produce.
 *
 * The engine ends a classic match as soon as only one team is alive, so a room
 * that starts with every player on the same team immediately resolves as a win.
 * Keeping this check in the setup UI prevents custom rooms from starting in
 * that invalid one-team shape.
 */
function getConfiguredTeamCount(playerCount: number, playersPerTeam: number) {
  return Math.ceil(playerCount / playersPerTeam);
}

/**
 * Custom-room setup/game scene for `/match/:roomId`.
 *
 * The route first joins the setup room identified by the URL. While setup is
 * active it renders the room lobby, host-only start control, player list, and
 * color picker. When the setup room emits a seat reservation, the same route
 * swaps into `GamePage` and consumes that reservation to enter the match room.
 */
export function CustomSetupRoom({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const userId = useUser((user) => user?.id);
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolvingRoom, setIsResolvingRoom] = useState(true);
  const [resolveRequestId, setResolveRequestId] = useState(0);
  const latestResolveRequestId = useRef(resolveRequestId);

  useEffect(() => {
    latestResolveRequestId.current = resolveRequestId;
  }, [resolveRequestId]);

  useEffect(() => {
    let isCurrent = true;
    const requestId = resolveRequestId;

    const run = async () => {
      setIsResolvingRoom(true);
      setResolveError(null);
      setResolvedRoomId(null);
      try {
        const resolution = await networkProvider.resolveCustomRoom(roomId);
        if (!isCurrent || latestResolveRequestId.current !== requestId) return;
        setResolvedRoomId(resolution.setupRoomId);
      } catch (error) {
        if (!isCurrent || latestResolveRequestId.current !== requestId) return;
        setResolveError(
          error instanceof Error
            ? error.message
            : "Failed to resolve custom room",
        );
      } finally {
        if (isCurrent) {
          setIsResolvingRoom(false);
        }
      }
    };

    void run();
    return () => {
      isCurrent = false;
    };
  }, [resolveRequestId, roomId]);

  const {
    room,
    setupState,
    seatReservation,
    startGame,
    updateSettings,
    clearSeatReservation,
    clearValidationError,
    error,
    validationError,
    isConnecting,
  } = useSetupRoom({
    roomId: resolvedRoomId ?? undefined,
    enabled: Boolean(resolvedRoomId),
  });

  useEffect(() => {
    if (!validationError) return;
    toast[validationError.severity]("Settings not applied", {
      description: validationError.message,
      duration: 5_000,
    });
    clearValidationError();
  }, [clearValidationError, validationError]);

  const handleReturnToSetup = useCallback(() => {
    clearSeatReservation();
    setResolveRequestId((requestId) => requestId + 1);
  }, [clearSeatReservation]);

  if (seatReservation) {
    /**
     * Custom matches keep the stable room URL in the address bar; `GamePage`
     * persists that key with the recovery token so refresh can restore the match.
     */
    return (
      <GamePage
        connection={{ type: "reservation", reservation: seatReservation }}
        source={{
          type: "custom",
          customRoomKey: roomId,
          onReturn: handleReturnToSetup,
        }}
      />
    );
  }

  if (resolveError || error) {
    /**
     * A failed setup join usually means the shared room URL is stale. Provide an
     * explicit lobby escape instead of trapping the user on the broken URL.
     */
    return (
      <StageCenter>
        <ErrorPanel
          title="Room unavailable"
          message={`${resolveError ?? error}. Check the shared URL or ask the host for a fresh room link.`}
          action={
            <Button type="button" onClick={() => navigate("/")}>
              Return to lobby
            </Button>
          }
        />
      </StageCenter>
    );
  }

  if (
    isResolvingRoom ||
    isConnecting ||
    !resolvedRoomId ||
    !setupState ||
    !room
  ) {
    return (
      <StageCenter>
        <LoadingPanel message="Joining custom room" />
      </StageCenter>
    );
  }

  const myPlayer = setupState.players.find((player) => player.id === userId);
  const takenColors = setupState.players.map((player) => player.color);
  const isHost = Boolean(myPlayer?.isHost);
  const teamCount = getConfiguredTeamCount(
    setupState.players.length,
    setupState.playersPerTeam,
  );
  const hasEnoughTeams = teamCount >= 2;
  const canStart = isHost && setupState.players.length >= 2 && hasEnoughTeams;

  return (
    <StageCenter>
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div>
              <p className="text-sm text-game-text-dim">Hello,</p>
              <p className="text-2xl font-bold">{displayName}</p>
            </div>
            <p className="text-sm text-game-text-dim">
              {isHost ? "You are host" : "You are guest"}
            </p>
          </div>
        </div>

        <div className="grid gap-8 border-t border-game-border pt-8 md:grid-cols-[1fr_20rem]">
          <div className="space-y-8">
            <GameSettings
              isHost={isHost}
              currentSettings={setupState}
              onChangeSettings={updateSettings}
            />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Pick Your Color</h2>
              {myPlayer ? (
                <ColorPicker
                  takenColors={takenColors}
                  currentColor={myPlayer.color}
                  onSelect={(color) =>
                    room?.send(SetupClientMessage.PICK_COLOR, { color })
                  }
                />
              ) : (
                <p className="text-sm text-game-text-dim">
                  Waiting for player assignment.
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {canStart ? (
                  <Button type="button" onClick={startGame}>
                    <Play className="size-4" />
                    Force start game
                  </Button>
                ) : null}
                {isHost && setupState.players.length >= 2 && !hasEnoughTeams ? (
                  <p className="basis-full text-sm text-game-text-dim">
                    Set Players Per Team lower to create at least two teams.
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/")}
                >
                  <LogOut className="size-4" />
                  Leave room
                </Button>
              </div>
            </section>
          </div>

          <RoomPlayerList
            players={setupState.players}
            currentUserId={userId}
            maxPlayers={setupState.maxPlayers}
            showHost
          />
        </div>
      </div>
    </StageCenter>
  );
}
