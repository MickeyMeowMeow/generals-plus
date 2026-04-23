import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useMatchConnectionStore } from "../../match/store/matchConnectionStore";

export function LobbyPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("skirmish-room");

  const connect = useMatchConnectionStore((state) => state.connect);
  const joinRoom = useMatchConnectionStore((state) => state.joinRoom);
  const setError = useMatchConnectionStore((state) => state.setError);
  const status = useMatchConnectionStore((state) => state.status);
  const roomId = useMatchConnectionStore((state) => state.roomId);
  const sessionId = useMatchConnectionStore((state) => state.sessionId);
  const lastError = useMatchConnectionStore((state) => state.lastError);

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextRoom = roomName.trim();
    if (!nextRoom) {
      setError("Room name is required");
      return;
    }

    await joinRoom(nextRoom);
    if (useMatchConnectionStore.getState().status === "connected") {
      navigate(`/match/${nextRoom}`);
    }
  };

  return (
    <section className="page" aria-label="Lobby Page">
      <h2>Lobby</h2>
      <p>Welcome commander. Initialize the connection and join a room.</p>
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
        <div className="actions">
          <button type="button" onClick={() => connect()}>
            Init connection
          </button>
          <button type="submit" disabled={status === "connecting"}>
            Join room
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
