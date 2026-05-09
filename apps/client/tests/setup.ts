import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

vi.mock("#/features/auth/providers/auth-provider", async () => {
  const [actual, { getTestAuthValue }, { createElement }] = await Promise.all([
    vi.importActual<typeof import("#/features/auth/providers/auth-provider")>(
      "#/features/auth/providers/auth-provider",
    ),
    import("./helpers/test-auth-state"),
    import("react"),
  ]);

  return {
    ...actual,
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      createElement(
        actual.AuthContext.Provider,
        { value: getTestAuthValue() },
        children,
      ),
  };
});
