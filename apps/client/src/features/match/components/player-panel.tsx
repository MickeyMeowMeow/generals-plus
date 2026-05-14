import { ArrowLeft, LogOut, User } from "lucide-react";
import { Link } from "react-router";

import { ErrorAlert } from "#/components/feedback/error-alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";

interface PlayerPanelProps {
  displayName: string;
  sessionId: string | null;
  roomState: string;
  lastError: string | null;
  onLeave: () => Promise<void>;
}

/** Side panel showing player info, session details, and leave controls. */
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
