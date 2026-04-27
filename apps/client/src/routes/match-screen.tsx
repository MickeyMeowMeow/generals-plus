import { RequireAuthenticated } from "#/common/guards";
import { GamePage } from "#/features/game/pages/game-page";

export default function MatchScreenRoute() {
  return (
    <RequireAuthenticated>
      <GamePage />
    </RequireAuthenticated>
  );
}
