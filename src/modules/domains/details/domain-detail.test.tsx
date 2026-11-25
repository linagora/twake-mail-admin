// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const head = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  apiClient: { head },
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
// Each section stands for itself: the page decides which ones it renders
const section = vi.hoisted(() => (name: string) => ({ default: () => <p>{name}</p> }));
vi.mock("./domain-quota", () => section("Quota"));
vi.mock("./domain-aliases", () => section("Aliases"));
vi.mock("./domain-team-mailboxes", () => section("Team Mailboxes"));
vi.mock("./domain-contacts", () => section("Contacts"));
vi.mock("./domain-tasks", () => section("Tasks"));
vi.mock("./domain-signature-templates", () => section("Signature Templates"));
vi.mock("./domain-jmap-report", () => section("JMAP Report"));
vi.mock("@/components/custom/rate-limits-section", () => section("Rate Limits"));
vi.mock("./domain-summary", () => ({ DomainSummary: () => <p>summary</p> }));

import DomainDetail from "./domain-detail";

const statusError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

const renderPage = (domain: string) => render(
  <MemoryRouter initialEntries={[`/domains/domain/${encodeURIComponent(domain)}`]}>
    <Routes><Route path="/domains/domain/:domain" element={<DomainDetail />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => { head.mockReset(); });
afterEach(cleanup);

describe("domain detail: domain state", () => {
  it("renders every section for a managed domain", async () => {
    head.mockResolvedValue(undefined);
    renderPage("example.com");
    expect(await screen.findByText("Quota")).not.toBeNull();
    expect(screen.getByText("Tasks")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(head).toHaveBeenCalledWith("/domains/example.com");
  });

  it("shows a notice and no section for a domain the server does not manage", async () => {
    head.mockRejectedValue(statusError(404));
    renderPage("nope.test");
    expect((await screen.findByRole("alert")).textContent).toContain("domains.noDomain.missing");
    expect(screen.getByText("domains.noDomain.kind")).not.toBeNull();
    expect(screen.getByRole("link", { name: "domains.noDomain.back" }).getAttribute("href")).toBe("/domains");
    for (const name of ["summary", "Quota", "Aliases", "Team Mailboxes", "Contacts", "Rate Limits", "JMAP Report", "Tasks"]) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it("renders the page as usual when the check fails for another reason", async () => {
    head.mockRejectedValue(statusError(403));
    renderPage("example.com");
    expect(await screen.findByText("Quota")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
