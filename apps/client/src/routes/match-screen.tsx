import { RequireAuthenticated } from "#/common/guards";

export default function MatchScreenRoute() {
  return (
    <RequireAuthenticated>
      <section className="page" aria-label="Match Screen Page">
        <h2>Match Screen</h2>
        <p>The game screen is not available in this branch.</p>
      </section>
    </RequireAuthenticated>
  );
}
