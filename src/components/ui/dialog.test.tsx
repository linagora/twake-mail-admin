// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "./dialog";

afterEach(cleanup);

const renderDialog = (className?: string) =>
  render(
    <Dialog open>
      <DialogContent className={className} aria-describedby={undefined}>
        <DialogTitle>Delete</DialogTitle>
        <p>{`Delete event in group ${"x".repeat(150)}?`}</p>
        <DialogFooter><button>Confirm</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

describe("DialogContent", () => {
  // jsdom computes no layout: check the rules that keep long unbreakable words inside the box
  it("breaks long words and keeps its grid column within the dialog width", () => {
    renderDialog();

    const classes = screen.getByRole("dialog").classList;
    expect(classes).toContain("[overflow-wrap:anywhere]");
    expect(classes).toContain("grid-cols-[minmax(0,1fr)]");
  });

  it("keeps these rules when the caller customises the dialog", () => {
    renderDialog("max-w-md max-h-[80vh] overflow-y-auto");

    const classes = screen.getByRole("dialog").classList;
    expect(classes).toContain("[overflow-wrap:anywhere]");
    expect(classes).toContain("grid-cols-[minmax(0,1fr)]");
    expect(classes).toContain("max-w-md");
  });

  it("names the corner close button in the current language", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "common.close" })).not.toBeNull();
  });
});
