// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

afterEach(cleanup);

describe("SheetContent", () => {
  // jsdom computes no layout: check the corner X is a 40 × 40 touch target, not its 16 px icon
  it("gives the corner close button a large touch target", () => {
    render(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Navigation</SheetTitle>
        </SheetContent>
      </Sheet>
    );

    const classes = screen.getByRole("button", { name: "common.close" }).classList;
    expect(classes).toContain("size-10");
  });
});
