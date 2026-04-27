import { NavLink } from "react-router";

import { APP_TITLE, NAV_LINKS } from "#/components/config/ui-constants";
import { cn } from "#/lib/utils";

/** Top navigation bar with app title and page links. */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-4">
      <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
      <nav aria-label="Primary" className="flex flex-wrap gap-2.5">
        {NAV_LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-game-accent text-game-accent"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
