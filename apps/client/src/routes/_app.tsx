import { useEffect } from "react";
import { Outlet } from "react-router";

import { AppHeader } from "#/components/layout/app-header";
import { PageContainer } from "#/components/layout/page-container";
import { useUserAuthStore } from "#/features/auth/store/user-auth-store";

export default function AppLayout() {
  const hydrateUser = useUserAuthStore((state) => state.hydrateUser);

  useEffect(() => {
    void hydrateUser();
  }, [hydrateUser]);

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <PageContainer>
        <Outlet />
      </PageContainer>
    </div>
  );
}
