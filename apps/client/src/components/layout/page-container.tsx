import type { ReactNode } from "react";

import { PAGE_MAX_WIDTH } from "#/components/config/ui-constants";
import { cn } from "#/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/** Centered max-width container wrapping page content. */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className="flex flex-1 justify-center px-5 pb-10 pt-6">
      <div
        className={cn(
          PAGE_MAX_WIDTH,
          "w-full rounded-xl border border-border bg-card p-6",
          className,
        )}
      >
        {children}
      </div>
    </main>
  );
}
