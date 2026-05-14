import { Outlet } from "react-router";

import { AuthProvider } from "#/features/auth/hooks";

export default function AppLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
