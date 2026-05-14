import { Link } from "react-router";

import { Button } from "#/components/ui/button";
import {
  BrandTitle,
  GameStage,
  StageCenter,
  StagePanel,
} from "#/features/game/components/game-stage";

export default function NotFoundPage() {
  return (
    <GameStage>
      <StageCenter>
        <div className="mx-auto grid max-w-xl gap-6">
          <BrandTitle compact />
          <StagePanel className="text-center">
            <h2 className="text-3xl font-black uppercase">Page not found</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-game-text-dim">
              This route is outside the current command map.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/">Return home</Link>
            </Button>
          </StagePanel>
        </div>
      </StageCenter>
    </GameStage>
  );
}
