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

  it("never asks about the global routes, which span every tenant", () => {
    ["/registeredUsers", "/tasks", "/mailingLists"].forEach((p) => allowed.deny.add(p));
    renderSidebar(<CalendarDomainSidebar />);
    expect(groups().flatMap((g) => g.entries)).toEqual(expect.arrayContaining(["Registered Users", "Tasks"]));
    cleanup();
    renderSidebar(<DomainSidebar />);
    expect(groups().flatMap((g) => g.entries)).toEqual(expect.arrayContaining(["Mailing Lists", "Tasks"]));
  });

  it("gates the calendar entries on the domain-scoped routes", () => {
    [
      "/domains/{domain}/registeredUsers",
      "/domains/{domain}?action=deleteData",
      "/addressbook/domain-members/{domain}",
      "/domains/{domain}/contacts?action=republish",
      "/domains/{domain}/addressbooks/dab/contactCount",
      "/domains/{domain}/addressbooks/dab?action=export",
      "/domains/{domain}/addressbooks/dab?action=import",
      "/domains/{domain}/addressbooks/dab/contacts",
      "/domains/{domain}/addressbooks/dab?action=copyFrom",
      "/domains/{domain}/addressbooks/domain-members/contactCount",
      "/domains/{domain}/addressbooks/domain-members?action=export",
      "/domains/{domain}/tasks/{id}",
    ].forEach((p) => allowed.deny.add(p));
    renderSidebar(<CalendarDomainSidebar />);
    const entries = groups().flatMap((g) => g.entries);
    expect(entries).not.toContain("Registered Users");
    expect(entries).not.toContain("Tasks");
  });

  it("gates the mail entries on the domain-scoped routes", () => {
    [
      "/mailingLists?domain={domain}",
      "/domains/{domain}/signature-templates?action=apply",
      "/domains/{domain}?action=deleteData",
      "/domains/{domain}/templates",
      "/domains/{domain}/tasks/{id}",
    ].forEach((p) => allowed.deny.add(p));
    renderSidebar(<DomainSidebar />);
    const entries = groups().flatMap((g) => g.entries);
    expect(entries).not.toContain("Mailing Lists");
    expect(entries).not.toContain("Tasks");
  });

  it("marks only the current entry", () => {
    renderSidebar(<DomainSidebar />, "/users/user/alice@example.com");
    const current = Array.from(document.querySelectorAll('a[aria-current="page"]')).map((a) => a.textContent);
    expect(current).toEqual(["Users"]);
  });
});
