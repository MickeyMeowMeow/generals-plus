import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "#/components/ui/button";

describe("Button motion classes", () => {
  it("uses the shared motion timing tokens", () => {
    render(<Button>Launch</Button>);

    expect(screen.getByRole("button").className).toContain(
      "duration-(--motion-duration-fast)",
    );
  });
});
