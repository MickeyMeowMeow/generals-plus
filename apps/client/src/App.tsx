import { NavLink, Outlet } from "react-router-dom";

import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Generals Plus</h1>
        <nav aria-label="Primary">
          <NavLink to="/lobby" className="nav-link">
            Lobby
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
