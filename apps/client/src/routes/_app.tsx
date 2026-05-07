import { useEffect } from "react";
import { Outlet } from "react-router";

import { AppHeader } from "#/components/layout/app-header";
import { PageContainer } from "#/components/layout/page-container";
import { useAuthStore } from "#/features/auth/hooks";

export default function AppLayout() {
  const hydrateUser = useAuthStore((state) => state.hydrate);

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
