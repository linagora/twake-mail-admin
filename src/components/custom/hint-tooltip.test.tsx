// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HintTooltip from "./hint-tooltip";

afterEach(cleanup);

const renderHint = () => render(
  <HintTooltip hint="Cannot be deleted">
    <button disabled>Delete</button>
  </HintTooltip>
);

const trigger = () => screen.getByRole("button", { name: "Delete" }).parentElement!;

describe("hint tooltip", () => {
  it("is focusable and described by its hint, without a native title", () => {
    renderHint();
    expect(trigger().tabIndex).toBe(0);
    expect(trigger().getAttribute("title")).toBeNull();
    expect(document.getElementById(trigger().getAttribute("aria-describedby")!)!.textContent).toBe("Cannot be deleted");
  });

  it("opens on a tap, and closes on a second one", () => {
    renderHint();
    fireEvent.pointerDown(trigger(), { pointerType: "touch" });
    fireEvent.click(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
    fireEvent.click(trigger());
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on keyboard focus", () => {
    renderHint();
    fireEvent.focus(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });
});
