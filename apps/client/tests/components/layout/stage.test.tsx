import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Stage } from "#/components/layout";
import { AuthStatus } from "#/features/auth/auth-store";
import { AuthProvider } from "#/features/auth/hooks";
import { createMockAuth } from "#/tests/helpers/auth";
import { setAuthValue } from "#/tests/helpers/render";

describe("Stage background", () => {
  test("sets the stage background from a direct backgroundUrl prop", () => {
    render(
      <Stage backgroundUrl="https://cdn.example.com/direct.jpg">
        <p>Scene</p>
      </Stage>,
    );

    expect(screen.getByRole("main").getAttribute("style")).toContain(
      '--stage-background-image: url("https://cdn.example.com/direct.jpg")',
    );
  });

  test("escapes quotes in the stage background URL", () => {
    render(
      <Stage
        backgroundUrl={
          'https://cdn.example.com/a"),linear-gradient(red,blue),url("x'
        }
      >
        <p>Scene</p>
      </Stage>,
    );

    expect(screen.getByRole("main").getAttribute("style")).toContain(
      '--stage-background-image: url("https://cdn.example.com/a\\"),linear-gradient(red,blue),url(\\"x")',
    );
  });

  test("sets the stage background from a preset user preference", () => {
    setAuthValue(
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: {
          id: "user-1",
          displayName: "Commander",
          preferences: {
            backgroundImage: { source: "preset", presetId: "classic" },
          },
        },
      }),
    );

    render(
      <AuthProvider>
        <Stage>
          <p>Scene</p>
        </Stage>
      </AuthProvider>,
    );

    expect(screen.getByRole("main").getAttribute("style")).toContain(
      '--stage-background-image: url("/bg.jpg")',
    );
  });

  test("sets the stage background from a custom URL user preference", () => {
    setAuthValue(
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: {
          id: "user-1",
          displayName: "Commander",
          preferences: {
            backgroundImage: {
              source: "customUrl",
              customUrl: "https://cdn.example.com/custom.jpg",
            },
          },
        },
      }),
    );

    render(
      <AuthProvider>
        <Stage>
          <p>Scene</p>
        </Stage>
      </AuthProvider>,
    );

    expect(screen.getByRole("main").getAttribute("style")).toContain(
      '--stage-background-image: url("https://cdn.example.com/custom.jpg")',
    );
  });
});
