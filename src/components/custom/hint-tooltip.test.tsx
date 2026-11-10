// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import HintTooltip from "./hint-tooltip";

afterEach(cleanup);

const renderHint = () => render(
  <HintTooltip hint="Cannot be deleted">
    <button disabled>Delete</button>
  </HintTooltip>
);

const trigger = () => screen.getByRole("button", { name: "Delete" }).parentElement!;

// A browser fires the compatibility mouse events of a tap after the pointer is released, and only
// focuses the element when it does not have the focus yet.
const tap = (element: HTMLElement) => {
  fireEvent.pointerDown(element, { pointerType: "touch" });
  fireEvent.pointerUp(element, { pointerType: "touch" });
  fireEvent.pointerLeave(element, { pointerType: "touch" });
  fireEvent.mouseDown(element);
  if (document.activeElement !== element) {
    act(() => element.focus());
  }
  fireEvent.mouseUp(element);
  fireEvent.click(element);
};

const tapOutside = () => {
  fireEvent.pointerDown(document.body, { pointerType: "touch" });
  fireEvent.pointerUp(document.body, { pointerType: "touch" });
  fireEvent.click(document.body);
  act(() => trigger().blur());
};

describe("hint tooltip", () => {
  it("is focusable and described by its hint, without a native title", () => {
    renderHint();
    expect(trigger().tabIndex).toBe(0);
    expect(trigger().getAttribute("title")).toBeNull();
    expect(document.getElementById(trigger().getAttribute("aria-describedby")!)!.textContent).toBe("Cannot be deleted");
  });

  it("is described once by its hint while the tooltip is open", () => {
    renderHint();
    fireEvent.focus(trigger());
    const description = trigger().getAttribute("aria-describedby")!.split(/\s+/)
      .map(id => document.getElementById(id)!.textContent);
    expect(description).toEqual(["Cannot be deleted"]);
  });

  it("opens on a first tap", () => {
    renderHint();
    tap(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });

  it("stays open on a further tap", () => {
    renderHint();
    tap(trigger());
    tap(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });

  it("closes on a tap elsewhere, and opens again on the next tap", () => {
    renderHint();
    tap(trigger());
    tapOutside();
    expect(screen.queryByRole("tooltip")).toBeNull();
    tap(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });

  it("opens on a tap of an engine that does not focus the trigger", () => {
    renderHint();
    fireEvent.pointerDown(trigger(), { pointerType: "touch" });
    fireEvent.pointerUp(trigger(), { pointerType: "touch" });
    fireEvent.click(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });

  it("stays open through a mouse click", () => {
    renderHint();
    fireEvent.pointerDown(trigger(), { pointerType: "mouse" });
    fireEvent.mouseDown(trigger());
    act(() => trigger().focus());
    fireEvent.pointerUp(trigger(), { pointerType: "mouse" });
    fireEvent.mouseUp(trigger());
    fireEvent.click(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });

  it("opens on keyboard focus", () => {
    renderHint();
    fireEvent.focus(trigger());
    expect(screen.getByRole("tooltip").textContent).toBe("Cannot be deleted");
  });
});
