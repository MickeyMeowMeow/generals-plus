import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

export type MatchStatusMode = "eliminated" | "game-end";

interface StatusDialogProps {
  mode: MatchStatusMode | null;
  didWin: boolean;
  winnerTeamLabel: string | null;
  winnerTeamMembers: string[];
  returnLabel: string;
  onSpectate: () => void;
  onReturn: () => void;
}

export function StatusDialog({
  mode,
  didWin,
  winnerTeamLabel,
  winnerTeamMembers,
  returnLabel,
  onSpectate,
  onReturn,
}: StatusDialogProps) {
  const winnerName = winnerTeamMembers[0];
  const isTeamResult = winnerTeamMembers.length > 1;

  const getTitle = () => {
    if (mode === "eliminated") {
      return "You have been eliminated";
    }
    if (didWin) {
      return isTeamResult ? "Your team won" : "You won";
    }
    if (winnerTeamLabel) {
      return isTeamResult ? "Your team lost" : "You lost";
    }
    return "Game over";
  };

  return (
    <Dialog open={Boolean(mode)}>
      <DialogContent
        className="max-w-sm"
        aria-describedby={undefined}
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{getTitle()}</DialogTitle>
        </DialogHeader>
        <div className="mt-3 space-y-1 text-sm text-game-text-dim">
          {mode === "eliminated" ? null : (
            <>
              {!didWin && isTeamResult && winnerTeamLabel ? (
                <p>
                  Winners: {winnerTeamLabel}, {winnerTeamMembers.join(" & ")}
                </p>
              ) : null}
              {didWin && isTeamResult && winnerTeamLabel ? (
                <p>Team members: {winnerTeamMembers.join(" & ")}</p>
              ) : null}
              {!didWin && !isTeamResult && winnerName ? (
                <p>Winner: {winnerName}</p>
              ) : null}
              {!winnerTeamLabel && !winnerName ? (
                <p>No winner was reported.</p>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onSpectate}>
            View as spectator
          </Button>
          <Button type="button" onClick={onReturn}>
            {returnLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
