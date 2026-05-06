import { ColorPicker } from "#/components/game/color-picker";
import { useUserAuthStore } from "#/features/auth/store/user-auth-store";
import { useQueueRoom } from "#/features/game/api/use-queue-room";
import { GamePage } from "#/features/game/pages/game-page";

export function QueueManager() {
  const { room, queueState, seatReservation } = useQueueRoom();
  const user = useUserAuthStore((s) => s.user as { id: string } | null);

  if (seatReservation) {
    return <GamePage reservation={seatReservation} />;
  }

  if (!queueState) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Connecting to Queue...
      </div>
    );
  }

  const myPlayer = queueState.players.find((p) => p.id === user?.id);
  const takenColors = queueState.players.map((p) => p.color);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl mb-6">Matchmaking Queue</h1>

      <div className="mb-6">
        <h2 className="text-xl border-b mb-2">
          Players in Queue ({queueState.players.length})
        </h2>
        <ul className="space-y-2">
          {queueState.players.map((player) => (
            <li key={player.id} className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{
                  backgroundColor: `#${player.color.toString(16).padStart(6, "0")}`,
                }}
              />
              {player.username}
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

      <p className="text-gray-400">Waiting for players...</p>
    </div>
  );
}
