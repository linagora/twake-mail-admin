// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router";
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
    <MemoryRouter initialEntries={["/users"]}>
      <SidebarProvider>
        <Sidebar>
          <Link to="/domains">Domains</Link>
        </Sidebar>
        <MobileSidebarBar />
      </SidebarProvider>
    </MemoryRouter>
  );
}

function openSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "sidebar.toggle" }));
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
    expect(screen.queryByText("Domains")).toBeNull();

    openSidebar();

    expect(screen.queryByText("Domains")).not.toBeNull();
  });

  it("closes the mobile sidebar when an entry is chosen", () => {
    renderLayout();
    openSidebar();

    fireEvent.click(screen.getByText("Domains"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
