import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

interface DisconnectDialogProps {
  message: string | null;
  returnLabel: string | null;
  onReturn: () => void;
}

export function DisconnectDialog({
  message,
  returnLabel,
  onReturn,
}: DisconnectDialogProps) {
  return (
    <Dialog open={Boolean(message)}>
      <DialogContent
        className="max-w-sm"
        aria-describedby={undefined}
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Disconnected</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onReturn}>
            {returnLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
