import { AlertTriangle } from "lucide-react";

import { StatusBadge } from "#/components/feedback/status-badge";
import { Badge } from "#/components/ui/badge";
import { Separator } from "#/components/ui/separator";

interface MatchHeaderProps {
  roomId: string;
  connectionStatus: string;
  isReconnecting: boolean;
}

/** Top HUD bar showing room ID, connection status, and reconnection warning. */
export function MatchHeader({
  roomId,
  connectionStatus,
  isReconnecting,
}: MatchHeaderProps) {
  return (
    <div className="border-b border-border bg-game-surface px-5 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Match Room</h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            {roomId || "unknown"}
          </Badge>
          <StatusBadge status={connectionStatus} />
        </div>
      </div>

      {isReconnecting ? (
        <>
          <Separator className="my-2" />
          <p
            className="flex items-center gap-1.5 text-sm text-warning"
            role="alert"
          >
            <AlertTriangle className="size-3.5" />
            Connection lost. Attempting to reconnect...
          </p>
        </>
      ) : null}
    </div>
  );
}
