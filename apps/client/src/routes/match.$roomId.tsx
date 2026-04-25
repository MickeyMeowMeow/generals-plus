import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { RequireAuthenticated } from "#/common/guards";
import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { useMatchConnectionStore } from "#/features/match/store/matchConnectionStore";

// In-game page for an active match room. Auto-joins by roomId on mount and leaves on unmount.
function MatchPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const resolvedRoomId = roomId ?? "";
  const status = useMatchConnectionStore((state) => state.status);
  const displayName = useUserAuthStore((state) => state.displayName);
  const activeRoomId = useMatchConnectionStore((state) => state.roomId);
  const sessionId = useMatchConnectionStore((state) => state.sessionId);
  const isReconnecting = useMatchConnectionStore(
    (state) => state.isReconnecting,
  );
  const lastError = useMatchConnectionStore((state) => state.lastError);
  const getRoom = useMatchConnectionStore((state) => state.getRoom);
  const joinById = useMatchConnectionStore((state) => state.joinById);
  const reconnect = useMatchConnectionStore((state) => state.reconnect);
  const leaveRoom = useMatchConnectionStore((state) => state.leaveRoom);
  const setError = useMatchConnectionStore((state) => state.setError);
  const hasLeftRef = useRef(false);

  // Auto-join the room when the page loads or the route changes.
  useEffect(() => {
    if (!resolvedRoomId) {
      setError("Route does not contain a room ID");
      return;
    }

    // Already connected or connecting to the correct room — nothing to do.
    if (
      activeRoomId === resolvedRoomId &&
      (status === "connected" ||
        status === "connecting" ||
        status === "reconnecting")
    ) {
      return;
    }

    // Attempt reconnection before fresh join when idle/disconnected.
    if (status === "idle" || status === "disconnected") {
      void reconnect().then(() => {
        const { status: s, roomId: r } = useMatchConnectionStore.getState();
        if (s !== "connected" || r !== resolvedRoomId) {
          void joinById(resolvedRoomId);
        }
      });
      return;
    }

    // Not connected to the target room — join by ID.
    void joinById(resolvedRoomId);
  }, [activeRoomId, joinById, reconnect, resolvedRoomId, setError, status]);

  // Leave the room on unmount, unless handleLeave already did.
  useEffect(() => {
    return () => {
      if (!hasLeftRef.current) {
        void leaveRoom();
      }
    };
  }, [leaveRoom]);

  const handleLeave = async () => {
    hasLeftRef.current = true;
    await leaveRoom();
    navigate("/lobby");
  };

  const room = getRoom();

  return (
    <section className="page" aria-label="Match Page">
      <h2>Match Room</h2>
      <p>Room ID: {resolvedRoomId || "unknown"}</p>
      <p>Player: {displayName ?? "anonymous"}</p>
      <p className="status-line" role="status">
        Connection status: {isReconnecting ? "reconnecting" : status}
      </p>
      {sessionId ? <p>Session ID: {sessionId}</p> : null}

      {lastError ? (
        <p className="error-text" role="alert">
          {lastError}
        </p>
      ) : null}

      {isReconnecting ? (
        <p className="reconnect-text" role="alert">
          Connection lost. Attempting to reconnect...
        </p>
      ) : null}

      <p className="state-preview">Room state: {room ? "connected" : "none"}</p>

      <div className="actions">
        <button type="button" onClick={handleLeave}>
          Leave room
        </button>
      </div>
      <p>
        <Link
          to="/lobby"
          onClick={(event) => {
            event.preventDefault();
            void handleLeave();
          }}
        >
          Back to lobby
        </Link>
      </p>
    </section>
  );
}

export default function MatchRoute() {
  return (
    <RequireAuthenticated>
      <MatchPage />
    </RequireAuthenticated>
  );
}
