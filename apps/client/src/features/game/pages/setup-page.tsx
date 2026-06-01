import { GameMode } from "@generals-plus/engine";
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
import {
  MotionStaggerGroup,
  MotionStaggerItem,
} from "#/features/motion/components/motion-stagger";
import { Avatar } from "#/features/profile/components/avatar";
import { networkProvider } from "#/infra/network/provider";
import { HttpRequestError } from "#/infra/network/provider/colyseus";

const DEMOLITION_TEAM_GROUPS = [
  { id: "attackers", label: "Attackers" },
  { id: "defenders", label: "Defenders" },
] as const;

const PAYLOAD_TEAM_GROUPS = [
  { id: "team_0", label: "Team 1" },
  { id: "team_1", label: "Team 2" },
] as const;

const RUGBY_TEAM_GROUPS = [
  { id: "team_0", label: "Team 1" },
  { id: "team_1", label: "Team 2" },
] as const;

function getTeamCapacity({ playersPerTeam }: { playersPerTeam: number }) {
  return playersPerTeam;
}

function getSetupTeamOrder(teamId: string) {
  const match = /^setup_team_(\d+)$/.exec(teamId);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
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
  const preferences = useUser((user) => user?.preferences);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<{
    message: string;
    status: number | null;
  } | null>(null);
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
          error instanceof HttpRequestError
            ? { message: error.message, status: error.status }
            : {
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to resolve custom room",
                status: null,
              },
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
    return (
      <GamePage
        connection={{ type: "reservation", reservation: seatReservation }}
        source={{
          type: "custom",
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
          message={
            resolveError?.status === 409
              ? resolveError.message
              : `${resolveError?.message ?? error}. Check the shared URL or ask the host for a fresh room link.`
          }
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

  const playersWithTeams = setupState.players.map((player) => ({
    ...player,
    teamId: player.teamId,
  }));
  const myPlayer = playersWithTeams.find((player) => player.id === userId);
  const takenColors = setupState.players.map((player) => player.color);
  const isHost = Boolean(myPlayer?.isHost);
  const shouldShowTeamControls =
    setupState.gameMode === GameMode.DEMOLITION ||
    setupState.gameMode === GameMode.PAYLOAD ||
    setupState.gameMode === GameMode.RUGBY ||
    setupState.playersPerTeam > 1;
  const occupiedTeamIds = Array.from(
    new Set(
      playersWithTeams
        .map((player) => player.teamId)
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  ).sort((left, right) => getSetupTeamOrder(left) - getSetupTeamOrder(right));
  const teamCapacity = getTeamCapacity(setupState);
  const teamGroups =
    setupState.gameMode === GameMode.DEMOLITION
      ? DEMOLITION_TEAM_GROUPS.map((team) => ({
          ...team,
          count: playersWithTeams.filter((player) => player.teamId === team.id)
            .length,
          capacity: teamCapacity,
        }))
      : setupState.gameMode === GameMode.PAYLOAD
        ? PAYLOAD_TEAM_GROUPS.map((team) => ({
            ...team,
            count: playersWithTeams.filter(
              (player) => player.teamId === team.id,
            ).length,
            capacity: teamCapacity,
          }))
        : setupState.gameMode === GameMode.RUGBY
          ? RUGBY_TEAM_GROUPS.map((team) => ({
              ...team,
              count: playersWithTeams.filter(
                (player) => player.teamId === team.id,
              ).length,
              capacity: teamCapacity,
            }))
          : occupiedTeamIds.map((teamId) => ({
              id: teamId,
              label: "",
              count: playersWithTeams.filter(
                (player) => player.teamId === teamId,
              ).length,
              capacity: teamCapacity,
            }));
  const hasOversizedTeams = teamGroups.some(
    (team) => team.count > team.capacity,
  );
  const hasEnoughTeams = occupiedTeamIds.length >= 2;
  const canStart =
    isHost &&
    setupState.players.length >= 2 &&
    hasEnoughTeams &&
    !hasOversizedTeams;

  return (
    <StageCenter>
      <MotionStaggerGroup className="mx-auto grid w-full max-w-5xl gap-8">
        <MotionStaggerItem>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar preferences={preferences?.avatar} />
              <div>
                <p className="text-sm text-game-text-dim">Hello,</p>
                <p className="text-2xl font-bold">{displayName}</p>
              </div>
            </div>
            <p className="text-sm text-game-text-dim">
              {isHost ? "You are host" : "You are guest"}
            </p>
          </div>
        </MotionStaggerItem>

        <MotionStaggerItem className="grid gap-8 border-t border-game-border pt-8 md:grid-cols-[1fr_20rem]">
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
                {!hasOversizedTeams &&
                setupState.players.length >= 2 &&
                !hasEnoughTeams ? (
                  <p className="basis-full text-sm text-amber-300">
                    {setupState.gameMode === GameMode.DEMOLITION ||
                    setupState.gameMode === GameMode.PAYLOAD ||
                    setupState.gameMode === GameMode.RUGBY
                      ? "Members on both teams are required to start the game."
                      : "At least two teams are required to start the game."}
                  </p>
                ) : null}
                {hasOversizedTeams ? (
                  <p className="basis-full text-sm text-amber-300">
                    Each team must have no more than {teamCapacity} players to
                    start the game.
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
            players={playersWithTeams}
            currentUserId={userId}
            maxPlayers={setupState.maxPlayers}
            showHost
            teamGroups={shouldShowTeamControls ? teamGroups : undefined}
            onJoinTeam={
              shouldShowTeamControls
                ? (teamId) =>
                    room?.send(SetupClientMessage.PICK_TEAM, { teamId })
                : undefined
            }
            onCreateTeam={
              shouldShowTeamControls &&
              setupState.gameMode !== GameMode.DEMOLITION &&
              setupState.gameMode !== GameMode.PAYLOAD &&
              setupState.gameMode !== GameMode.RUGBY
                ? () =>
                    room?.send(SetupClientMessage.PICK_TEAM, {
                      createNew: true,
                    })
                : undefined
            }
          />
        </MotionStaggerItem>
      </MotionStaggerGroup>
    </StageCenter>
  );
}
