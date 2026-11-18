// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SidebarProvider } from "@/components/ui/sidebar";

const allowed = vi.hoisted(() => ({ deny: new Set<string>() }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: (_verb: string, pattern: string) => !allowed.deny.has(pattern) }));
vi.mock("@/components/custom/oidc-provider", () => ({ useOIDC: () => ({ logout: vi.fn() }) }));
vi.mock("@/components/custom/auth-provider", () => ({ useAuth: () => ({ isAuthenticated: false, clearToken: vi.fn() }) }));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL", sso: false } }));

import { AppSidebar } from "./side-bar";

const renderSidebar = () => render(
  <MemoryRouter>
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  </MemoryRouter>
);

// The entries of each group, as their links read
const groups = () => Array.from(document.querySelectorAll('[data-sidebar="group"]')).map((group) => ({
  label: group.querySelector('[data-sidebar="group-label"]')?.textContent,
  entries: Array.from(group.querySelectorAll("a")).map((a) => a.textContent),
}));

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  cleanup();
  allowed.deny.clear();
});

describe("sidebar groups", () => {
  it("groups the mail entries by what the operator comes to do", () => {
    renderSidebar();
    expect(groups()).toEqual([
      { label: "Monitoring", entries: ["Health Check", "Mail Repositories", "Event Dead Letter", "Network Channels", "Live Metrics"] },
      { label: "Accounts and addresses", entries: ["Users", "Domains", "Mappings", "Mailing Lists", "Global Quota"] },
      { label: "Maintenance", entries: ["Tasks", "Common Tasks", "Cassandra", "Resource Locator", "JMAP Settings Report"] },
    ]);
  });

  it("hides a group none of whose entries is allowed", () => {
    ["/tasks", "/tasks/{id}", "/cassandra/version", "/mailboxes/{mailboxId}", "/jmap/settings/reports"].forEach((p) => allowed.deny.add(p));
    renderSidebar();
    expect(groups().map((g) => g.label)).toEqual(["Monitoring", "Accounts and addresses"]);
    expect(screen.queryByText("Maintenance")).toBeNull();
  });
});
