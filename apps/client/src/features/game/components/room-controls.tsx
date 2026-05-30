import { Crown, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "#/lib/utils";

interface RoomPlayer {
  id: string;
  displayName: string;
  color: number;
  isHost?: boolean;
  teamId?: string;
}

interface RoomTeamGroup {
  id: string;
  label: string;
  count: number;
  capacity: number;
}

interface RoomPlayerListProps {
  /** Players currently present in a queue or setup room. */
  players: Iterable<RoomPlayer>;
  /** Authenticated user id used to emphasize the local player. */
  currentUserId: string | null | undefined;
  /** Optional capacity label for setup rooms. */
  maxPlayers?: number;
  /** Whether host badges should be shown beside setup-room players. */
  showHost?: boolean;
  /** Existing setup-room groups, shown in scoreboard-like sections. */
  teamGroups?: RoomTeamGroup[];
  /** Called when the local player joins an existing setup-room group. */
  onJoinTeam?: (teamId: string) => void;
  /** Called when the local player creates a new setup-room group. */
  onCreateTeam?: () => void;
}

/** Converts numeric player colors into CSS hex values. */
export function colorToHex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Shared flat player list for queue and setup screens.
 *
 * It keeps identity presentation consistent while letting each route own the
 * surrounding layout and room-specific controls.
 */
export function RoomPlayerList({
  players,
  currentUserId,
  maxPlayers,
  showHost = false,
  teamGroups,
  onJoinTeam,
  onCreateTeam,
}: RoomPlayerListProps) {
  const playerList = Array.from(players);
  const [dragCandidateId, setDragCandidateId] = useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);
  const draggingPlayer =
    playerList.find((player) => player.id === draggingPlayerId) ?? null;
  const canManageTeams = Boolean(teamGroups && (onJoinTeam || onCreateTeam));
  const groupedTeams =
    teamGroups?.map((team) => ({
      ...team,
      players: playerList
        .filter((player) => player.teamId === team.id)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
    })) ?? [];

  const resetDragState = useCallback(() => {
    dragPointerId.current = null;
    dragStartPoint.current = null;
    setDragCandidateId(null);
    setDraggingPlayerId(null);
    setDropTargetId(null);
    setDragPosition(null);
  }, []);

  useEffect(() => {
    if (!dragCandidateId && !draggingPlayerId) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (
        dragPointerId.current !== event.pointerId ||
        !dragStartPoint.current
      ) {
        return;
      }

      if (draggingPlayerId) return;

      const deltaX = Math.abs(event.clientX - dragStartPoint.current.x);
      const deltaY = Math.abs(event.clientY - dragStartPoint.current.y);
      if (deltaX < 4 && deltaY < 4) return;

      setDraggingPlayerId(dragCandidateId);
      setDragPosition({ x: event.clientX, y: event.clientY });
    };

    const updateDropTarget = (clientX: number, clientY: number) => {
      const dropTarget = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-team-drop-id],[data-create-team-drop]");

      if (dropTarget?.dataset.teamDropId) {
        setDropTargetId(dropTarget.dataset.teamDropId);
        return dropTarget;
      }

      if (dropTarget?.dataset.createTeamDrop === "true") {
        setDropTargetId("create-team");
        return dropTarget;
      }

      setDropTargetId(null);
      return null;
    };

    const handleDraggingPointerMove = (event: PointerEvent) => {
      if (dragPointerId.current !== event.pointerId) return;
      if (!draggingPlayerId) return;

      setDragPosition({ x: event.clientX, y: event.clientY });
      updateDropTarget(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragPointerId.current !== event.pointerId) return;

      if (draggingPlayerId) {
        const dropTarget = updateDropTarget(event.clientX, event.clientY);

        const teamId = dropTarget?.dataset.teamDropId;
        if (teamId && onJoinTeam) {
          onJoinTeam(teamId);
        } else if (
          dropTarget?.dataset.createTeamDrop === "true" &&
          onCreateTeam
        ) {
          onCreateTeam();
        }
      }

      resetDragState();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointermove", handleDraggingPointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointermove", handleDraggingPointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    dragCandidateId,
    draggingPlayerId,
    onCreateTeam,
    onJoinTeam,
    resetDragState,
  ]);

  const renderPlayer = (player: RoomPlayer, aside?: ReactNode) => {
    const isCurrent = player.id === currentUserId;
    const isDraggable = canManageTeams && isCurrent;

    return (
      <li
        key={player.id}
        onPointerDown={(event) => {
          if (!isDraggable) return;
          dragPointerId.current = event.pointerId;
          dragStartPoint.current = { x: event.clientX, y: event.clientY };
          setDragCandidateId(player.id);
        }}
        className={cn(
          "relative flex select-none items-center gap-3 py-0.5 text-sm",
          isCurrent && "font-semibold",
          isDraggable && "cursor-grab active:cursor-grabbing",
          aside && "pr-14",
          (dragCandidateId === player.id || draggingPlayerId === player.id) &&
            "opacity-70",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 px-1.5">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: colorToHex(player.color) }}
          />
          <span className="truncate">{player.displayName}</span>
          {isCurrent && (!showHost || !player.isHost) ? (
            <UserRound
              className="ml-[-5px] size-3.5 shrink-0 text-game-text-dim"
              strokeWidth={2.5}
            />
          ) : null}
          {showHost && player.isHost ? (
            <Crown
              className="ml-[-5px] size-3.5 shrink-0 text-game-text-dim"
              strokeWidth={2.5}
            />
          ) : null}
        </span>
        {aside ? (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0">
            {aside}
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <section aria-label="Players" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Players</h2>
        <span className="text-sm text-game-text-dim">
          {playerList.length}
          {typeof maxPlayers === "number" ? ` / ${maxPlayers}` : ""}
        </span>
      </div>
      {canManageTeams ? (
        <div className="space-y-1">
          {groupedTeams.map((team, teamIndex) => (
            <div key={team.id} className="space-y-1">
              {teamIndex > 0 ? (
                <div className="border-t border-game-border/70" />
              ) : null}
              <div
                data-team-drop-id={team.id}
                className={cn(
                  "py-2",
                  dropTargetId === team.id &&
                    "bg-white/5 outline outline-1 outline-white/20",
                )}
              >
                {team.label ? (
                  <div className="flex items-center justify-between px-1.5 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-game-text-dim">
                      {team.label}
                    </span>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        team.count > team.capacity
                          ? "text-amber-300"
                          : "text-game-text-dim",
                      )}
                    >
                      {team.count} / {team.capacity}
                    </span>
                  </div>
                ) : null}
                <ul className="space-y-0">
                  {team.players.map((player, playerIndex) =>
                    renderPlayer(
                      player,
                      playerIndex === 0 && !team.label ? (
                        <span
                          className={cn(
                            "px-1.5 text-xs tabular-nums",
                            team.count > team.capacity
                              ? "text-amber-300"
                              : "text-game-text-dim",
                          )}
                        >
                          {team.count} / {team.capacity}
                        </span>
                      ) : undefined,
                    ),
                  )}
                </ul>
              </div>
            </div>
          ))}
          {onCreateTeam ? (
            <div className="space-y-1">
              {groupedTeams.length > 0 ? (
                <div className="border-t border-game-border/70" />
              ) : null}
              <div
                className={cn(
                  "py-0",
                  dropTargetId === "create-team" &&
                    "bg-white/5 outline outline-1 outline-white/20",
                )}
              >
                <button
                  type="button"
                  data-create-team-drop="true"
                  className={cn(
                    "w-full border border-dashed border-game-border px-3 py-2 text-center text-sm text-game-text-dim transition-colors",
                    dropTargetId === "create-team" && "border-transparent",
                  )}
                >
                  Drag and drop here to create a new team
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-1">
          {playerList.map((player) => renderPlayer(player))}
        </ul>
      )}
      {draggingPlayer && dragPosition ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-sm font-semibold text-game-text"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
          }}
        >
          <span className="flex items-center gap-2">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{
                backgroundColor: colorToHex(draggingPlayer.color),
              }}
            />
            <Crown
              className="mr-[-5px] size-3.5 shrink-0 text-game-text-dim"
              strokeWidth={2.5}
            />
            <span>{draggingPlayer.displayName}</span>
          </span>
        </div>
      ) : null}
    </section>
  );
}
