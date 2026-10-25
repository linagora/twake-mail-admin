// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SidebarProvider } from "@/components/ui/sidebar";

const allowed = vi.hoisted(() => ({ deny: new Set<string>() }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: (_verb: string, pattern: string) => !allowed.deny.has(pattern) }));
vi.mock("@/components/custom/oidc-provider", () => ({ useOIDC: () => ({ logout: vi.fn() }) }));
vi.mock("@/lib/config", () => ({ appConfig: { sso: false } }));
vi.mock("./domain-context", () => ({ useDomain: () => "example.com" }));

import { DomainSidebar } from "./domain-sidebar";
import { CalendarDomainSidebar } from "./calendar-domain-sidebar";

const renderSidebar = (sidebar: React.ReactNode, path = "/") => render(
  <MemoryRouter initialEntries={[path]}>
    <SidebarProvider>{sidebar}</SidebarProvider>
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

describe("domain-admin sidebar groups", () => {
  it("groups the mail domain entries like the global sidebar", () => {
    renderSidebar(<DomainSidebar />);
    expect(groups()).toEqual([
      { label: "Accounts and addresses", entries: ["Users", "Team Mailboxes", "Mailing Lists", "Domain Aliases"] },
      { label: "Domain settings", entries: ["Quota", "Rate Limiting"] },
      { label: "Maintenance", entries: ["Tasks"] },
    ]);
  });

  it("groups the calendar domain entries like the global sidebar", () => {
    renderSidebar(<CalendarDomainSidebar />);
    expect(groups()).toEqual([
      { label: "Accounts and addresses", entries: ["Users", "Registered Users", "Calendar Admins", "Resources"] },
      { label: "Domain settings", entries: ["Settings"] },
      { label: "Maintenance", entries: ["Tasks"] },
    ]);
  });

  it("hides a group none of whose entries is allowed", () => {
    ["/quota/domains/{domain}", "/domains/{domain}/ratelimits"].forEach((p) => allowed.deny.add(p));
    renderSidebar(<DomainSidebar />);
    expect(groups().map((g) => g.label)).toEqual(["Accounts and addresses", "Maintenance"]);
  });

  it("marks only the current entry", () => {
    renderSidebar(<DomainSidebar />, "/users/user/alice@example.com");
    const current = Array.from(document.querySelectorAll('a[aria-current="page"]')).map((a) => a.textContent);
    expect(current).toEqual(["Users"]);
  });
});
