import { SetupClientMessage } from "@generals-plus/shared-types";
import { LogOut, Play } from "lucide-react";
import { useNavigate } from "react-router";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { useUser } from "#/features/auth/hooks";
import { useSetupRoom } from "#/features/game/api/use-setup-room";
import { ColorPicker } from "#/features/game/components/color-picker";
import { GameSettings } from "#/features/game/components/game-settings";
import { RoomPlayerList } from "#/features/game/components/room-controls";
import { GamePage } from "#/features/game/pages/game-page";

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
  const {
    room,
    setupState,
    seatReservation,
    startGame,
    updateSettings,
    clearSeatReservation,
    error,
    isConnecting,
  } = useSetupRoom({ roomId });

  if (seatReservation) {
    /**
     * Custom matches keep the setup URL in the address bar; `GamePage` persists
     * the setup room id with the recovery token so refresh can restore the match.
     */
    return (
      <GamePage
        connection={{ type: "reservation", reservation: seatReservation }}
        source={{
          type: "custom",
          setupRoomId: roomId,
          onReturn: clearSeatReservation,
        }}
      />
    );
  }

  if (error) {
    /**
     * A failed setup join usually means the shared room URL is stale. Provide an
     * explicit lobby escape instead of trapping the user on the broken URL.
     */
    return (
      <StageCenter>
        <ErrorPanel
          title="Room unavailable"
          message={`${error}. Check the shared URL or ask the host for a fresh room link.`}
          action={
            <Button type="button" onClick={() => navigate("/")}>
              Return to lobby
            </Button>
          }
        />
      </StageCenter>
    );
  }

  if (isConnecting || !setupState) {
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
