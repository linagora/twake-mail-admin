// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { MemoryRouter } from "react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNavItem } from "./sidebar-nav-item";

const ITEM = { title: "Users", url: "/users", icon: Users };

function renderItem(isActive: boolean) {
  render(
    <MemoryRouter>
      <SidebarProvider>
        <SidebarNavItem item={ITEM} isActive={isActive} />
      </SidebarProvider>
    </MemoryRouter>
  );
  return screen.getByRole("link", { name: "Users" });
}

describe("SidebarNavItem", () => {
  beforeAll(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(cleanup);

  it("exposes the current page to assistive technologies", () => {
    const link = renderItem(true);

    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.getAttribute("data-active")).toBe("true");
  });

  it("does not mark the other entries as current", () => {
    const link = renderItem(false);

    expect(link.hasAttribute("aria-current")).toBe(false);
    expect(link.getAttribute("data-active")).toBe("false");
  });
});
