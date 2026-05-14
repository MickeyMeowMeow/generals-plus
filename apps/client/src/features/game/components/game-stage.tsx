import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { APP_TITLE, GAME_STAGE_COPY } from "#/config/ui-constants";
import { cn } from "#/lib/utils";

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

export function StageCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}

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
