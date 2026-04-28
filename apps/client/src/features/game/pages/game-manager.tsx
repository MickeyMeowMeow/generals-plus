import { useSetupRoom } from "#/features/game/api/use-setup-room";
import { GamePage } from "#/features/game/pages/game-page";

export function GameManager() {
  const { setupState, seatReservation, startGame } = useSetupRoom();

  // If we received a seat reservation, unmount Lobby and mount the actual Game
  if (seatReservation) {
    return <GamePage reservation={seatReservation} />;
  }

  // Otherwise, show the Setup/Lobby Room
  if (!setupState) {
    return <div>Connecting to Lobby...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl mb-6">Game Lobby</h1>

      <div className="mb-6">
        <h2 className="text-xl border-b mb-2">
          Players ({setupState.players.length} / {setupState.maxPlayers})
        </h2>
        <ul className="space-y-2">
          {setupState.players.map((player) => (
            <li key={player.id}>
              {player.username} {player.isHost && "(Host)"}
            </li>
          ))}
        </ul>
      </div>

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
