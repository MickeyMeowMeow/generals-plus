import type { SubmitEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { RequireAuthenticated } from "#/common/guards";
import { useAuth, useUser } from "#/features/auth/hooks";
import { PlayerInfo } from "#/features/lobby/components/player-info";
import { RoomJoinForm } from "#/features/lobby/components/room-join-form";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

/** Landing page after authentication for joining or creating game rooms. */
function LobbyPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("skirmish-room");
  const [roomAccessCode, setRoomAccessCode] = useState("");

  const { state: authState, actions: authActions } = useAuth();
  const displayName = useUser((user) => user?.displayName);

  const connect = useMatchConnectionStore((s) => s.connect);
  const joinRoom = useMatchConnectionStore((s) => s.joinRoom);
  const resetMatchConnection = useMatchConnectionStore((s) => s.reset);
  const setError = useMatchConnectionStore((s) => s.setError);
  const status = useMatchConnectionStore((s) => s.status);
  const roomId = useMatchConnectionStore((s) => s.roomId);
  const sessionId = useMatchConnectionStore((s) => s.sessionId);
  const lastError = useMatchConnectionStore((s) => s.lastError);

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
    await authActions.signOut();
    navigate("/user");
  };

  return (
    <div className="space-y-6">
      <PlayerInfo
        displayName={displayName ?? "anonymous"}
        authStatus={authState.status}
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
