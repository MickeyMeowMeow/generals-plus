import { RequireAuthenticated } from "#/common/guards";
import { QueueManager } from "#/features/game/pages/queue-manager";

export default function QueueRoute() {
  return (
    <RequireAuthenticated>
      <QueueManager />
    </RequireAuthenticated>
  );
}
