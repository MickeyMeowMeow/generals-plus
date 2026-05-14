import { Link } from "react-router";

import {
  BrandTitle,
  Stage,
  StageCenter,
  StagePanel,
} from "#/components/layout";
import { Button } from "#/components/ui/button";

/**
 * Stage-styled 404 for removed legacy routes and bad URLs.
 *
 * `/user`, `/lobby`, `/queue`, and `/match-screen` are intentionally no longer
 * compatibility redirects. Rendering the same game shell here makes those
 * misses explicit without bringing back the old business pages.
 */
export default function NotFoundPage() {
  return (
    <Stage>
      <StageCenter>
        <div className="mx-auto grid max-w-xl gap-6">
          <BrandTitle compact />
          <StagePanel className="text-center">
            <h2 className="text-2xl font-semibold">Page not found</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-game-text-dim">
              This route is outside the current command map.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/">Return home</Link>
            </Button>
          </StagePanel>
        </div>
      </StageCenter>
    </Stage>
  );
}
