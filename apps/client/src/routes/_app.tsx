import { Outlet } from "react-router";

import { AuthProvider } from "#/features/auth/hooks";

/**
 * Minimal app shell for the route-consolidated client.
 *
 * The old header-bearing layout was removed so individual routes can render a
 * full-screen game stage. Auth remains at the root because both `/` and
 * `/match/:roomId` need the same hydrated user/session state.
 */
export default function AppLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
