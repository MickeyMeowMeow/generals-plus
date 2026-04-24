import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { useMatchConnectionStore } from "#/features/match/store/matchConnectionStore";

// In-game page for an active match room. Auto-joins on mount and leaves on unmount.
export function MatchPage() {
  const navigate = useNavigate();
  const { roomName } = useParams<{ roomName: string }>();
  const resolvedRoomName = roomName ? decodeURIComponent(roomName) : "";

  const status = useMatchConnectionStore((state) => state.status);
  const displayName = useUserAuthStore((state) => state.displayName);
  const activeRoomName = useMatchConnectionStore((state) => state.roomName);
  const roomId = useMatchConnectionStore((state) => state.roomId);
  const sessionId = useMatchConnectionStore((state) => state.sessionId);
  const latestState = useMatchConnectionStore((state) => state.latestState);
  const lastError = useMatchConnectionStore((state) => state.lastError);
  const joinRoom = useMatchConnectionStore((state) => state.joinRoom);
  const leaveRoom = useMatchConnectionStore((state) => state.leaveRoom);
  const setError = useMatchConnectionStore((state) => state.setError);

  // Auto-join the room when the page loads or the route changes.
  useEffect(() => {
    if (!resolvedRoomName) {
      setError("Route does not contain a room name");
      return;
    }

    // Already connected to the correct room — nothing to do.
    if (status === "connected" && activeRoomName === resolvedRoomName) {
      return;
    }

    if (status === "idle" || status === "disconnected") {
      void joinRoom(resolvedRoomName);
    }
  }, [activeRoomName, joinRoom, resolvedRoomName, setError, status]);

  // Leave the room when the component unmounts.
  useEffect(() => {
    return () => {
      void leaveRoom();
    };
  }, [leaveRoom]);

  const handleLeave = async () => {
    await leaveRoom();
    navigate("/lobby");
  };

  return (
    <section className="page" aria-label="Match Page">
      <h2>Match Room</h2>
      <p>Room: {resolvedRoomName || "unknown"}</p>
      <p>Player: {displayName ?? "anonymous"}</p>
      <p className="status-line" role="status">
        Connection status: {status}
      </p>
      {roomId && sessionId ? (
        <p>
          Room ID: {roomId} | Session ID: {sessionId}
        </p>
      ) : null}

      {lastError ? (
        <p className="error-text" role="alert">
          {lastError}
        </p>
      ) : null}

      <p className="state-preview">
        Latest state: {JSON.stringify(latestState)}
      </p>

      <div className="actions">
        <button type="button" onClick={handleLeave}>
          Leave room
        </button>
      </div>
      <p>
        <Link to="/lobby">Back to lobby</Link>
      </p>
    </section>
  );
}
