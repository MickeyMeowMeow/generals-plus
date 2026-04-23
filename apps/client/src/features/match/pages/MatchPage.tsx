import { Link, useParams } from "react-router-dom";

export function MatchPage() {
  const { roomName } = useParams<{ roomName: string }>();

  return (
    <section className="page" aria-label="Match Page">
      <h2>Match Room</h2>
      <p>Room: {roomName ?? "unknown"}</p>
      <p>
        <Link to="/lobby">Back to lobby</Link>
      </p>
    </section>
  );
}
