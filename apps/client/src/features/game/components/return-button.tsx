import { Undo2 } from "lucide-react";

import { Button } from "#/components/ui/button";

export function ReturnButton({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="pointer-events-auto inline-flex rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-1 shadow-xl shadow-black/25 backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onReturn}
        aria-label="Return"
        title="Return"
        className="size-8 text-game-text hover:bg-white/8 hover:text-game-text"
      >
        <Undo2 className="mt-px size-5" />
      </Button>
    </div>
  );
}
