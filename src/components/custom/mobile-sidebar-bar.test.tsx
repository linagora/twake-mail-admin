// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Sidebar, SidebarProvider } from "../ui/sidebar";
import { MobileSidebarBar } from "./mobile-sidebar-bar";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

function renderLayout() {
  render(
    <SidebarProvider>
      <Sidebar>
        <a href="/users">Users</a>
      </Sidebar>
      <MobileSidebarBar />
    </SidebarProvider>
  );
}

afterEach(cleanup);

describe("mobile sidebar bar", () => {
  beforeEach(() => setViewportWidth(390));

  it("renders a trigger hidden from the md breakpoint upward", () => {
    renderLayout();
    const trigger = screen.getByRole("button", { name: "sidebar.toggle" });
    expect(trigger.closest("header")?.className).toContain("md:hidden");
  });

  it("opens the mobile sidebar when the trigger is clicked", () => {
    renderLayout();
    expect(screen.queryByText("Users")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "sidebar.toggle" }));

    expect(screen.queryByText("Users")).not.toBeNull();
  });

  it("names and describes the mobile sidebar dialog", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "sidebar.toggle" }));

    const dialog = screen.getByRole("dialog", { name: "sidebar.title" });
    expect(dialog.getAttribute("aria-describedby")).not.toBeNull();
    expect(screen.getByText("sidebar.description").id).toBe(dialog.getAttribute("aria-describedby"));
  });
});
