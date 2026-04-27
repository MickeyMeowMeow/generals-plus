import { RequireAuthenticated } from "#/common/guards";
import { GamePage } from "#/features/game/pages/game-page";

export default function GameRoute() {
  return (
    <RequireAuthenticated>
      <div className="flex justify-center">
        <GamePage />
      </div>
    </RequireAuthenticated>
  );
}
