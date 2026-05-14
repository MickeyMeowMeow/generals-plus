import { ArrowLeft, LogOut, User } from "lucide-react";
import { Link } from "react-router";

import { ErrorAlert } from "#/components/feedback/error-alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";

interface PlayerPanelProps {
  /** Display name for the connected player. */
  displayName: string;
  /** Active Colyseus session id, shown when a room connection exists. */
  sessionId: string | null;
  /** Human-readable room lifecycle state for diagnostics. */
  roomState: string;
  /** Last room-level error to surface near the leave controls. */
  lastError: string | null;
  /** Leaves the current room and clears any associated connection state. */
  onLeave: () => Promise<void>;
}

/**
 * Compact player diagnostics panel for room-based flows.
 *
 * The main UI now uses stage-specific HUDs, but this panel remains as a reusable
 * room-control surface for tests or secondary tooling that needs session state,
 * errors, and an explicit leave action in one place.
 */
export function PlayerPanel({
  displayName,
  sessionId,
  roomState,
  lastError,
  onLeave,
}: PlayerPanelProps) {
  return (
    <Card size="sm" className="w-64">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4" />
          {displayName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessionId ? (
          <p className="font-mono text-xs text-muted-foreground">
            Session {sessionId}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">Room state: {roomState}</p>

        <ErrorAlert message={lastError} />

        <Separator />

        <div className="flex flex-col gap-2">
          <Button variant="destructive" size="sm" onClick={onLeave}>
            <LogOut className="size-3.5" />
            Leave room
          </Button>
          <Link
            to="/"
            onClick={(event) => {
              event.preventDefault();
              void onLeave();
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to lobby
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
