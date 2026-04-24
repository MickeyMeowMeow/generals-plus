import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <section className="page" aria-label="Not Found Page">
      <h2>Page not found</h2>
      <p>The route you requested does not exist.</p>
      <Link to="/lobby">Return to lobby</Link>
    </section>
  );
}
