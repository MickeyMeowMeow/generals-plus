import { CircleHelp } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import type { ModeHelpData } from "#/config/ui-constants";
import { GAME_MODE_HELP, GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { cn } from "#/lib/utils";

function ModeHelpContent({ help }: { help: ModeHelpData }) {
  return (
    <div className="grid gap-3">
      <DialogDescription className="text-sm text-game-text-dim">
        {help.summary}
      </DialogDescription>
      <ul className="grid gap-1.5 text-xs text-game-text-dim">
        {help.rules.map((rule) => (
          <li key={rule} className="flex gap-2">
            <span className="mt-1 size-1 shrink-0 rounded-full bg-game-text-dim" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Reusable help icon button that opens a dialog with mode rules.
 *
 * Place it inline next to a mode label to give players quick access to
 * detailed rules for the selected game mode.
 */
export function ModeHelpButton({
  gameMode,
  className,
}: {
  gameMode: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const option = GAME_MODE_OPTIONS.find((o) => o.id === gameMode);
  const label = option?.label ?? gameMode;
  const help = GAME_MODE_HELP[gameMode];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Help for ${label}`}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-none text-game-text-dim outline-none transition-colors hover:text-game-text [&_svg]:pointer-events-none [&_svg]:shrink-0",
          className,
        )}
      >
        <CircleHelp className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">{label}</DialogTitle>
          </DialogHeader>
          <ModeHelpContent help={help} />
        </DialogContent>
      </Dialog>
    </>
  );
}
