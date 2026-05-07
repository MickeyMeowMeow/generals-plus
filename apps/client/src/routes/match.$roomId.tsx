import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";

import { RequireAuthenticated } from "#/common/guards";
import { useUser } from "#/features/auth/hooks";
import { MatchHeader } from "#/features/match/components/match-header";
import { PlayerPanel } from "#/features/match/components/player-panel";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

/** In-game page for an active match room. Auto-joins by roomId on mount and leaves on unmount. */
function MatchPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const resolvedRoomId = roomId ?? "";
  const status = useMatchConnectionStore((state) => state.status);
  const displayName = useUser((user) => user?.displayName);
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

  useEffect(() => {
    if (!resolvedRoomId) {
      setError("Route does not contain a room ID");
      return;
    }

    if (
      activeRoomId === resolvedRoomId &&
      (status === "connected" ||
        status === "connecting" ||
        status === "reconnecting")
    ) {
      return;
    }

    if (status === "idle" || status === "disconnected") {
      void reconnect().then(() => {
        const { status: s, roomId: r } = useMatchConnectionStore.getState();
        if (s !== "connected" || r !== resolvedRoomId) {
          void joinById(resolvedRoomId);
        }
      });
      return;
    }

    void joinById(resolvedRoomId);
  }, [activeRoomId, joinById, reconnect, resolvedRoomId, setError, status]);

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
    <div className="flex flex-1 flex-col">
      <MatchHeader
        roomId={resolvedRoomId}
        connectionStatus={isReconnecting ? "reconnecting" : status}
        isReconnecting={isReconnecting}
      />
      <div className="relative flex-1">
        {/* PixiJS game board mounts here — not our concern */}
        <div className="absolute right-4 top-4 z-10">
          <PlayerPanel
            displayName={displayName ?? "anonymous"}
            sessionId={sessionId}
            roomState={room ? "connected" : "none"}
            lastError={lastError}
            onLeave={handleLeave}
          />
        </div>
      </div>
    </div>
  );
}

export default function MatchRoute() {
  return (
    <RequireAuthenticated>
      <MatchPage />
    </RequireAuthenticated>
  );
}
