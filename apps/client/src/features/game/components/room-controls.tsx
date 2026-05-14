import type { GameMode } from "@generals-plus/engine";

import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { cn } from "#/lib/utils";

interface RoomPlayer {
  id: string;
  displayName: string;
  color: number;
  isHost?: boolean;
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
}: RoomPlayerListProps) {
  const playerList = Array.from(players);

  return (
    <section aria-label="Players" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Players</h2>
        <span className="text-sm text-game-text-dim">
          {playerList.length}
          {typeof maxPlayers === "number" ? ` / ${maxPlayers}` : ""}
        </span>
      </div>
      <ul className="space-y-2">
        {playerList.map((player) => {
          const isCurrent = player.id === currentUserId;
          return (
            <li
              key={player.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border border-game-border px-3 py-2 text-sm",
                isCurrent && "font-semibold",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colorToHex(player.color) }}
                />
                <span className="truncate">{player.displayName}</span>
              </span>
              {showHost && player.isHost ? (
                <span className="text-xs text-game-text-dim">host</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface ModeSelectProps {
  /** Current setup mode from room state. */
  value: GameMode;
  /** Sends host-owned mode updates to the setup room. */
  onChange: (mode: GameMode) => void;
  /** Disables the select for non-host players. */
  disabled?: boolean;
}

/**
 * Native mode selector that exposes future modes without allowing unsupported
 * values to be selected before the backend can run them.
 */
export function ModeSelect({ value, onChange, disabled }: ModeSelectProps) {
  return (
    <label className="grid gap-1.5 text-sm text-game-text-dim">
      Game mode
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as GameMode)}
        className="h-9 rounded-lg border border-game-border bg-game-bg px-3 text-sm text-game-text outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-60"
      >
        {GAME_MODE_OPTIONS.map((mode) => (
          <option key={mode.id} value={mode.id} disabled={!mode.isEnabled}>
            {mode.label}
            {mode.isEnabled ? "" : " (coming soon)"}
          </option>
        ))}
      </select>
    </label>
  );
}
