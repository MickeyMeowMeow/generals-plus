import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  SettlementDialogKind,
  SettlementText,
} from "#/features/game/utils/settlement";

export interface SettlementDialogProps {
  readonly open: boolean;
  readonly kind: SettlementDialogKind;
  readonly winnerName: string | null;
  readonly onSpectate: () => void;
  readonly onExit: () => void;
}

class SettlementDialogCopy {
  static title(kind: SettlementDialogKind): string {
    if (kind === SettlementDialogKind.ELIMINATED) {
      return SettlementText.eliminatedTitle;
    }
    return SettlementText.gameEndedTitle;
  }

  static description(
    kind: SettlementDialogKind,
    winnerName: string | null,
  ): string {
    if (kind === SettlementDialogKind.ELIMINATED) {
      return SettlementText.eliminatedDescription;
    }
    if (winnerName) {
      return `${SettlementText.winnerDescriptionPrefix}${winnerName}`;
    }
    return SettlementText.gameEndedDescription;
  }
}

export function SettlementDialog({
  open,
  kind,
  winnerName,
  onSpectate,
  onExit,
}: SettlementDialogProps) {
  const isEliminatedDialog = kind === SettlementDialogKind.ELIMINATED;

  return (
    <Dialog open={open}>
      <DialogContent
        // The match screen decides when the player can leave or spectate; the
        // dialog itself stays modal so accidental outside clicks do not bypass
        // that flow.
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{SettlementDialogCopy.title(kind)}</DialogTitle>
          <DialogDescription>
            {SettlementDialogCopy.description(kind, winnerName)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onExit}>
            {SettlementText.exitAction}
          </Button>
          {isEliminatedDialog ? (
            <Button type="button" onClick={onSpectate}>
              {SettlementText.spectateAction}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
