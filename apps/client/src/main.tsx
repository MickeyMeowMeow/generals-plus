import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { appRouter } from "#/features/common/router";

import "./index.css";

const root = document.getElementById("root");
if (!root) {
  console.error("Root element not found");
} else {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={appRouter} />
    </StrictMode>,
  );
}
