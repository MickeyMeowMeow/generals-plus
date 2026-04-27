import { User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";
import { StatusBadge } from "../feedback/status-badge";

interface PlayerInfoProps {
  displayName: string;
  authStatus: string;
  roomId: string | null;
  sessionId: string | null;
}

/** Displays current player name, auth status, and active session info. */
export function PlayerInfo({
  displayName,
  authStatus,
  roomId,
  sessionId,
}: PlayerInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Lobby</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          <span className="font-medium">{displayName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Auth</span>
          <StatusBadge status={authStatus} />
        </div>
        {roomId && sessionId ? (
          <>
            <Separator />
            <p className="font-mono text-xs text-muted-foreground">
              Session {sessionId} in room {roomId}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
