import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";

import "./App.css";

/**
 * Root client component; routing can grow here once lobby and account flows exist.
 */
function App() {
  const hydrateUser = useUserAuthStore((state) => state.hydrateUser);

  // Kick off session hydration once on app startup.
  useEffect(() => {
    void hydrateUser();
  }, [hydrateUser]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Generals Plus</h1>
        <nav aria-label="Primary">
          <NavLink to="/user" className="nav-link">
            User
          </NavLink>
          <NavLink to="/lobby" className="nav-link">
            Lobby
          </NavLink>
          <NavLink to="/match-screen" className="nav-link">
            Match Screen
          </NavLink>
        </nav>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
