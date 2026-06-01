import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { SurrenderKey } from "#/features/game/utils/hotkey";

interface SurrenderDialogProps {
  canSurrender: boolean;
  onSurrender: () => void;
}

export function SurrenderOverlay({
  canSurrender,
  onSurrender,
}: SurrenderDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === SurrenderKey) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={isOpen && canSurrender} onOpenChange={setIsOpen}>
      <DialogContent
        className="max-w-sm"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Surrender match?</DialogTitle>
          <DialogDescription>
            This will immediately eliminate you from the current match.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setIsOpen(false);
              onSurrender();
            }}
          >
            Surrender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
