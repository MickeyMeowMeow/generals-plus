// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function SmokeApp() {
  return <h1>Client test bootstrap</h1>;
}

describe("client test setup", () => {
  it("renders with testing-library", () => {
    render(<SmokeApp />);
    expect(
      screen.getByRole("heading", { name: "Client test bootstrap" }),
    ).toBeTruthy();
  });
});
