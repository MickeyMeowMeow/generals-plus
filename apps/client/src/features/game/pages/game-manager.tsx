import { ColorPicker } from "#/components/game/color-picker";
import { useUser } from "#/features/auth/hooks";
import { useSetupRoom } from "#/features/game/api/use-setup-room";
import { GamePage } from "#/features/game/pages/game-page";

export function GameManager() {
  const { room, setupState, seatReservation, startGame } = useSetupRoom();
  const userId = useUser((user) => user?.id);

  // If we received a seat reservation, unmount Lobby and mount the actual Game
  if (seatReservation) {
    return <GamePage reservation={seatReservation} />;
  }

  // Otherwise, show the Setup/Lobby Room
  if (!setupState) {
    return <div>Connecting to Lobby...</div>;
  }

  const myPlayer = setupState.players.find((p) => p.id === userId);
  const takenColors = setupState.players.map((p) => p.color);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl mb-6">Game Lobby</h1>

      <div className="mb-6">
        <h2 className="text-xl border-b mb-2">
          Players ({setupState.players.length} / {setupState.maxPlayers})
        </h2>
        <ul className="space-y-2">
          {setupState.players.map((player) => (
            <li key={player.id} className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{
                  backgroundColor: `#${player.color.toString(16).padStart(6, "0")}`,
                }}
              />
              {player.username} {player.isHost && "(Host)"}
            </li>
          ))}
        </ul>
      </div>

      {myPlayer && (
        <div className="mb-6">
          <h3 className="text-sm mb-2 text-gray-400">Pick your color</h3>
          <ColorPicker
            takenColors={takenColors}
            currentColor={myPlayer.color}
            onSelect={(color) => room?.send("pickColor", { color })}
          />
        </div>
      )}

      <button
        type="button"
        onClick={startGame}
        disabled={setupState.players.length < 2}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
      >
        Start Game
      </button>
    </div>
  );
}
