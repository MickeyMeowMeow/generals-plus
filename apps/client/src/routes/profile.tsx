import { RequireAuthenticated } from "#/common/guards";
import { Stage } from "#/components/layout";
import { ProfilePage } from "#/features/profile/pages/profile-page";

export default function ProfileRoute() {
  return (
    <RequireAuthenticated>
      <Stage>
        <ProfilePage />
      </Stage>
    </RequireAuthenticated>
  );
}
