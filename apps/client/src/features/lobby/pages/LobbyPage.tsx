import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { useMatchConnectionStore } from "#/features/match/store/matchConnectionStore";

// Landing page after authentication. Lets the player join or create a game room.
export function LobbyPage() {
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

  // Attempt to join a room. If the room requires an access code, include it in the options.
  // Navigate to the match page on success.
  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextRoom = roomName.trim();
    if (!nextRoom) {
      setError("Room name is required");
      return;
    }

    // Build join options — access code is optional and only sent when provided.
    const nextAccessCode = roomAccessCode.trim();
    const joinOptions: Record<string, unknown> = {
      user: {
        displayName: displayName ?? "anonymous",
      },
    };

    if (nextAccessCode) {
      joinOptions.roomAuth = {
        accessCode: nextAccessCode,
      };
    }

    await joinRoom(nextRoom, joinOptions);
    if (useMatchConnectionStore.getState().status === "connected") {
      navigate(`/match/${nextRoom}`);
    }
  };

  // Tear down the match connection, clear auth state, and return to the user page.
  const handleSignOut = async () => {
    await resetMatchConnection();
    await signOut();
    navigate("/user");
  };

  return (
    <section className="page" aria-label="Lobby Page">
      <h2>Lobby</h2>
      <p>Welcome commander. Authenticate, then join a protected room.</p>
      <p>
        Player: <strong>{displayName ?? "anonymous"}</strong>
      </p>
      <p>Auth status: {authStatus}</p>
      <p className="status-line" role="status">
        Connection status: {status}
      </p>

      {lastError ? (
        <p className="error-text" role="alert">
          {lastError}
        </p>
      ) : null}

      <form className="room-form" onSubmit={handleJoin}>
        <label htmlFor="room-name">Room name</label>
        <input
          id="room-name"
          name="roomName"
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
        />
        <label htmlFor="room-access-code">Room access code (optional)</label>
        <input
          id="room-access-code"
          name="roomAccessCode"
          value={roomAccessCode}
          onChange={(event) => setRoomAccessCode(event.target.value)}
          autoComplete="off"
        />
        <div className="actions">
          <button type="button" onClick={() => connect()}>
            Init connection
          </button>
          <button type="submit" disabled={status === "connecting"}>
            Join room
          </button>
          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </form>

      {roomId && sessionId ? (
        <p>
          Active session: {sessionId} in room {roomId}
        </p>
      ) : null}
    </section>
  );
}
