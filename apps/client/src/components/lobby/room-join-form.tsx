import { Loader2, LogOut, Plug } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { ErrorAlert } from "../feedback/error-alert";
import { StatusBadge } from "../feedback/status-badge";

interface RoomJoinFormProps {
  roomName: string;
  accessCode: string;
  onRoomNameChange: (value: string) => void;
  onAccessCodeChange: (value: string) => void;
  isConnecting: boolean;
  lastError: string | null;
  connectionStatus: string;
  onConnect: () => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSignOut: () => Promise<void>;
}

/** Form for joining or connecting to a game room. */
export function RoomJoinForm({
  roomName,
  accessCode,
  onRoomNameChange,
  onAccessCodeChange,
  isConnecting,
  lastError,
  connectionStatus,
  onConnect,
  onJoin,
  onSignOut,
}: RoomJoinFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Join Room</h3>
        </CardTitle>
        <CardDescription>
          Enter a room name to join, or init a connection first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Connection</span>
          <StatusBadge status={connectionStatus} />
        </div>

        <ErrorAlert message={lastError} />

        <form onSubmit={onJoin} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              name="roomName"
              value={roomName}
              onChange={(event) => onRoomNameChange(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="room-access-code">Access code (optional)</Label>
            <Input
              id="room-access-code"
              name="roomAccessCode"
              value={accessCode}
              onChange={(event) => onAccessCodeChange(event.target.value)}
              autoComplete="off"
            />
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onConnect}>
              <Plug className="size-4" />
              Connect
            </Button>
            <Button type="submit" disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Join room
            </Button>
            <Button type="button" variant="ghost" onClick={onSignOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
