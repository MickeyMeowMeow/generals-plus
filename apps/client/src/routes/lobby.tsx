import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { RequireAuthenticated } from "#/common/guards";
import { PageContainer } from "#/components/layout/page-container";
import { useUserAuthStore } from "#/features/auth/store/user-auth-store";
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

  const authStatus = useUserAuthStore((state) => state.status);
  const displayName = useUserAuthStore((state) => state.displayName);
  const signOut = useUserAuthStore((state) => state.signOut);

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
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
    <PageContainer>
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
    </PageContainer>
  );
}

export default function LobbyRoute() {
  return (
    <RequireAuthenticated>
      <LobbyPage />
    </RequireAuthenticated>
  );
}
