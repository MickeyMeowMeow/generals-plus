import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { APP_TITLE, GAME_STAGE_COPY } from "#/config/ui-constants";
import { cn } from "#/lib/utils";

/**
 * Full-screen visual shell used by every route in the rebuilt client.
 *
 * The old app header/page-container split was replaced with this stage so the
 * official flow, custom-room flow, not-found state, and game view all share the
 * same command-room background, grid treatment, and safe full-viewport sizing.
 */
export function GameStage({ children }: { children: ReactNode }) {
  return (
    <main className="game-stage min-h-svh overflow-hidden text-game-text">
      <div className="game-stage__grid" aria-hidden="true" />
      <div className="relative z-10 flex min-h-svh flex-col px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

/**
 * Branded game title treatment for lobby/setup/auth screens.
 *
 * `compact` keeps the art-title readable in denser screens such as queue and
 * custom setup, while the default size is reserved for first-entry auth/lobby
 * moments where the brand should dominate the viewport.
 */
export function BrandTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("text-center", compact ? "space-y-1" : "space-y-2")}>
      <p className="text-xs font-semibold uppercase text-teal-200/70">
        {GAME_STAGE_COPY.eyebrow}
      </p>
      <h1
        className={cn(
          "game-brand mx-auto max-w-full font-black uppercase leading-none",
          compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-7xl lg:text-8xl",
        )}
      >
        {APP_TITLE}
      </h1>
    </div>
  );
}

/**
 * Centers a stage scene while preserving the shared full-screen background.
 *
 * Most non-game states are intentionally presented as a focused scene in the
 * middle of the viewport rather than as conventional document pages.
 */
export function StageCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}

/**
 * Glass-style panel primitive for game-stage UI.
 *
 * This is used for primary scene panels, loading states, and errors so the
 * rebuilt UI keeps one consistent surface language without reviving the old
 * title-bar layout.
 */
export function StagePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("game-panel rounded-lg p-5 shadow-2xl", className)}>
      {children}
    </section>
  );
}

/**
 * Fixed overlay panel for match/setup metadata.
 *
 * The HUD floats above the stage so game and setup content can stay centered
 * while room information remains visible without occupying layout space.
 */
export function FloatingHud({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "game-panel fixed right-4 top-4 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-lg p-4",
        className,
      )}
    >
      {children}
    </aside>
  );
}

/**
 * Branded loading surface for all route and room-connection waits.
 *
 * Keeping loading in a stage panel prevents temporary Colyseus/auth states from
 * falling back to raw text during navigation or socket handoff.
 */
export function LoadingPanel({ message }: { message: string }) {
  return (
    <StagePanel className="mx-auto max-w-sm text-center">
      <Loader2 className="mx-auto mb-3 size-6 animate-spin text-teal-200" />
      <p className="text-sm font-semibold uppercase text-game-text-dim">
        {message}
      </p>
    </StagePanel>
  );
}

/**
 * Branded error surface for room, auth, and route failures.
 *
 * Errors are rendered as in-game panels so missing rooms, failed joins, and bad
 * URLs feel like part of the client shell instead of unstyled browser states.
 */
export function ErrorPanel({
  title = "Connection failed",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <StagePanel className="mx-auto max-w-md">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div>
          <h2 className="text-lg font-black uppercase">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-game-text-dim">{message}</p>
        </div>
      </div>
    </StagePanel>
  );
}
