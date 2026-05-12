import { Outlet } from "react-router";

import { AppHeader } from "#/components/layout/app-header";
import { PageContainer } from "#/components/layout/page-container";
import { AuthProvider } from "#/features/auth/hooks";

export default function AppLayout() {
  return (
    <AuthProvider>
      <div className="flex min-h-svh flex-col">
        <AppHeader />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>
    </AuthProvider>
  );
}
