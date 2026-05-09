import type { AuthContextValue } from "#/features/auth/auth-store";
import { Outlet } from "react-router";

import { AppHeader } from "#/components/layout/app-header";
import { PageContainer } from "#/components/layout/page-container";
import { AuthProvider } from "#/features/auth/hooks";

interface AppLayoutProps {
  /**
   * An optional pre-built auth context value for dependency injection.
   * Used primarily in tests to control initial state and mock actions.
   */
  authValue?: AuthContextValue;
}

export default function AppLayout({ authValue }: AppLayoutProps) {
  return (
    <AuthProvider value={authValue}>
      <div className="flex min-h-svh flex-col">
        <AppHeader />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>
    </AuthProvider>
  );
}
