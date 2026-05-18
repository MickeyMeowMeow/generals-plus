import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Toaster } from "#/components/ui/sonner";
import { APP_TITLE } from "#/config/ui-constants";
import { cn } from "#/lib/utils";

/**
 * Full-screen shell shared by route scenes.
 *
 * The stage keeps the no-header app shape while deliberately avoiding decorative
 * chrome so lobby, setup, and match screens can own the visible hierarchy.
 */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <main className="game-stage min-h-svh overflow-hidden text-game-text">
      <div className="relative flex min-h-svh flex-col px-2 sm:px-6 lg:px-8">
        {children}
      </div>
      <Toaster closeButton position="bottom-right" />
    </main>
  );
}

/**
 * Plain game title treatment for auth, lobby, queue, and setup screens.
 */
export function BrandTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center">
      <h1
        className={cn(
          "game-brand mx-auto max-w-full font-semibold leading-tight",
          compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl",
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
    <div className="stage-center">
      <div className="stage-center-backdrop" aria-hidden="true" />
      <div className="stage-center-content">
        <div className="px-8 sm:px-12 lg:px-14">{children}</div>
      </div>
    </div>
  );
}

/**
 * Flat panel primitive for focused transient states.
 */
export function StagePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("game-panel p-5", className)}>{children}</section>
  );
}

/**
 * Fixed overlay panel for match metadata.
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
        "fixed right-3 top-3 z-30 max-h-[calc(100svh-1.5rem)] w-[min(19.5rem,calc(100vw-1.5rem))] overflow-auto border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-3 shadow-xl shadow-black/25 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </aside>
  );
}

/**
 * Loading surface for route and room-connection waits.
 */
export function LoadingPanel({ message }: { message: string }) {
  return (
    <StagePanel className="mx-auto max-w-sm text-center">
      <Loader2 className="mx-auto mb-3 size-5 animate-spin text-game-accent" />
      <p className="text-sm text-game-text-dim">{message}</p>
    </StagePanel>
  );
}

/**
 * Error surface for room, auth, and route failures.
 *
 * `action` lets connection-oriented callers offer a concrete escape hatch, such
 * as returning to the lobby after a stale room link or join failure.
 */
export function ErrorPanel({
  title = "Connection failed",
  message,
  action,
}: {
  /** Short heading shown above the failure message. */
  title?: string;
  /** User-facing explanation of what went wrong. */
  message: string;
  /** Optional command rendered below the message. */
  action?: ReactNode;
}) {
  return (
    <StagePanel className="mx-auto max-w-md">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-game-text-dim">{message}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </StagePanel>
  );
}
