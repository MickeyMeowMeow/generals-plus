import "@testing-library/jest-dom/vitest";

import { afterEach, vi } from "vitest";

Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.setPointerCapture ??= vi.fn();
Element.prototype.releasePointerCapture ??= vi.fn();

// jsdom doesn't provide EventSource — stub it out so useSystemSettings doesn't throw in tests
if (!("EventSource" in globalThis)) {
  Object.defineProperty(globalThis, "EventSource", {
    value: class EventSource {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      onopen: ((e: Event) => void) | null = null;
      close() {}
      addEventListener() {}
      removeEventListener() {}
    },
    writable: true,
  });
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

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
