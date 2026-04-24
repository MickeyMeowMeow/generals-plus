import type { RouteConfig } from "@react-router/dev/routes";
import { layout, route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
  layout("routes/_app.tsx", [
    ...(await flatRoutes({
      ignoredRouteFiles: ["routes/_app.tsx", "routes/not-found.tsx"],
    })),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
