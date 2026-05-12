import { RequireAuthenticated } from "#/common/guards";
import { GameManager } from "#/features/game/pages/game-manager";

export default function MatchScreenRoute() {
  return (
    <RequireAuthenticated>
      <GameManager />
    </RequireAuthenticated>
  );
}
