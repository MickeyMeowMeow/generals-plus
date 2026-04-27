import type { LucideProps } from "lucide-react";
import { LogIn, User } from "lucide-react";

/** Maximum content width for standard page layouts. */
export const PAGE_MAX_WIDTH = "max-w-3xl";

/** Standard inner padding for page content. */
export const PAGE_PADDING = "p-6";

/** App title displayed in the header. */
export const APP_TITLE = "Generals Plus";

/** Navigation link definitions for the app header. */
export const NAV_LINKS: readonly {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ComponentType<LucideProps>;
}[] = [
  { to: "/user", label: "User", icon: User },
  { to: "/lobby", label: "Lobby", icon: LogIn },
] as const;
