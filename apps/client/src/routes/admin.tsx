import { RequireAdmin } from "#/common/guards";
import { Stage } from "#/components/layout";
import { AdminSettingsPage } from "#/features/admin/pages/admin-settings-page";

export default function AdminRoute() {
  return (
    <RequireAdmin>
      <Stage>
        <AdminSettingsPage />
      </Stage>
    </RequireAdmin>
  );
}
