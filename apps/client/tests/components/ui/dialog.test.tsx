import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent } from "#/components/ui/dialog";

describe("Dialog motion", () => {
  it("marks dialog surfaces with shared motion data attributes", () => {
    render(
      <Dialog open>
        <DialogContent>Motion dialog</DialogContent>
      </Dialog>,
    );

    expect(
      screen
        .getByText("Motion dialog")
        .closest("[data-motion-surface='dialog']"),
    ).toBeTruthy();
  });
});
