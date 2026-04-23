import { Link } from "react-router-dom";

export function LobbyPage() {
  return (
    <section className="page" aria-label="Lobby Page">
      <h2>Lobby</h2>
      <p>Welcome commander. Choose a room to start the match flow.</p>
      <p>
        <Link to="/match/skirmish-room">Go to skirmish-room</Link>
      </p>
    </section>
  );
}
