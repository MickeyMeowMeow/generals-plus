import { StrictMode } from "react";
import { Links, Meta, Outlet, Scripts } from "react-router";

import "./index.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Generals Plus</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <StrictMode>
      <Outlet />
    </StrictMode>
  );
}

export function HydrateFallback() {
  return (
    <div id="root">
      <p>Loading...</p>
    </div>
  );
}
