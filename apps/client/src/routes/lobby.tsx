import type { SubmitEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { RequireAuthenticated } from "#/common/guards";
import { useAuthStore, useUser } from "#/features/auth/hooks";
import { PlayerInfo } from "#/features/lobby/components/player-info";
import { RoomJoinForm } from "#/features/lobby/components/room-join-form";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

/** Landing page after authentication for joining or creating game rooms. */
function LobbyPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("skirmish-room");
  const [roomAccessCode, setRoomAccessCode] = useState("");

  const connect = useMatchConnectionStore((state) => state.connect);
  const joinRoom = useMatchConnectionStore((state) => state.joinRoom);
  const resetMatchConnection = useMatchConnectionStore((state) => state.reset);
  const setError = useMatchConnectionStore((state) => state.setError);
  const status = useMatchConnectionStore((state) => state.status);
  const roomId = useMatchConnectionStore((state) => state.roomId);
  const sessionId = useMatchConnectionStore((state) => state.sessionId);
  const lastError = useMatchConnectionStore((state) => state.lastError);

  const authStatus = useAuthStore((state) => state.status);
  const signOut = useAuthStore((state) => state.signOut);
  const displayName = useUser((state) => state?.displayName);

  const handleJoin = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextRoom = roomName.trim();
    if (!nextRoom) {
      setError("Room name is required");
      return;
    }

    const nextAccessCode = roomAccessCode.trim();
    const joinOptions: Record<string, unknown> = {
      user: { displayName: displayName ?? "anonymous" },
    };

    if (nextAccessCode) {
      joinOptions.roomAuth = { accessCode: nextAccessCode };
    }

    await joinRoom(nextRoom, joinOptions);
    const { status, roomId } = useMatchConnectionStore.getState();
    if (status === "connected" && roomId) {
      navigate(`/match/${encodeURIComponent(roomId)}`);
    }
  };

  const handleSignOut = async () => {
    await resetMatchConnection();
    await signOut();
    navigate("/user");
  };

  return (
    <div className="space-y-6">
      <PlayerInfo
        displayName={displayName ?? "anonymous"}
        authStatus={authStatus}
        roomId={roomId}
        sessionId={sessionId}
      />
      <RoomJoinForm
        roomName={roomName}
        accessCode={roomAccessCode}
        onRoomNameChange={setRoomName}
        onAccessCodeChange={setRoomAccessCode}
        isConnecting={status === "connecting"}
        lastError={lastError}
        connectionStatus={status}
        onConnect={() => connect()}
        onJoin={handleJoin}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

export default function LobbyRoute() {
  return (
    <RequireAuthenticated>
      <LobbyPage />
    </RequireAuthenticated>
  );
}
