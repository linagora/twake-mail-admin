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
vi.mock("./user-mailboxes", () => section("Mailboxes"));
vi.mock("./user-quota", () => section("Quota"));
vi.mock("./user-aliases", () => section("Aliases"));
vi.mock("./user-forwards", () => ({ default: ({ noMailbox }: { noMailbox?: boolean }) => <p>{noMailbox ? "Forwards without mailbox" : "Forwards"}</p> }));
vi.mock("./user-team-mailboxes", () => section("Team Mailboxes"));
vi.mock("./user-vacation", () => section("Vacation"));
vi.mock("./user-delegation", () => section("Delegation"));
vi.mock("./user-allowed-from", () => section("Allowed From"));
vi.mock("./user-identities", () => section("Identities"));
vi.mock("./user-tasks", () => section("Tasks"));
vi.mock("./user-channels", () => section("Channels"));
vi.mock("./user-mappings", () => section("Mappings"));
vi.mock("./user-deleted-message-vault", () => section("Vault"));
vi.mock("./user-labels", () => section("Labels"));
vi.mock("./user-jmap-settings", () => section("JMAP Settings"));
vi.mock("@/components/custom/rate-limits-section", () => section("Rate Limits"));
vi.mock("./user-summary", () => ({ MailUserSummary: ({ forwardsOnly }: { forwardsOnly?: boolean }) => <p>{forwardsOnly ? "summary: forwards" : "summary"}</p> }));

import UserDetail from "./user-detail";

const statusError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

const renderPage = (username: string) => render(
  <MemoryRouter initialEntries={[`/users/user/${encodeURIComponent(username)}`]}>
    <Routes><Route path="/users/user/:username" element={<UserDetail />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => { head.mockReset(); });
afterEach(cleanup);

describe("user detail: account state", () => {
  it("renders every section for an existing account", async () => {
    head.mockResolvedValue(undefined);
    renderPage("bob@example.com");
    expect(await screen.findByText("Mailboxes")).not.toBeNull();
    expect(screen.getByText("Forwards")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows only Forwards and Mappings for an address without account", async () => {
    head.mockRejectedValue(statusError(404));
    renderPage("nobody@example.com");
    expect((await screen.findByRole("alert")).textContent).toContain("users.noAccount.missing");
    expect(screen.getByText("users.noAccount.kind")).not.toBeNull();
    expect(screen.getByText("Forwards without mailbox")).not.toBeNull();
    expect(screen.getByText("Mappings")).not.toBeNull();
    expect(screen.getByText("summary: forwards")).not.toBeNull();
    expect(screen.queryByText("Mailboxes")).toBeNull();
    expect(screen.queryByText("Labels")).toBeNull();
    expect(screen.getByRole("link", { name: "users.noAccount.search" }).getAttribute("href")).toBe("/users?q=nobody");
  });

  it("shows no section for an address WebAdmin refuses", async () => {
    head.mockRejectedValue(statusError(400));
    renderPage("a@b@c");
    expect((await screen.findByRole("alert")).textContent).toContain("users.noAccount.invalid");
    expect(screen.queryByText(/Forwards/)).toBeNull();
  });

  it("shows no section, without asking WebAdmin, for a name no account can have", async () => {
    // WebAdmin answers 404 to a name with spaces, as to a missing account
    head.mockRejectedValue(statusError(404));
    renderPage("not an address");
    expect(head).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain("users.noAccount.invalid");
    expect(screen.queryByText(/Forwards/)).toBeNull();
    expect(screen.queryByText("Mappings")).toBeNull();
  });

  it("renders the page as usual when the check fails for another reason", async () => {
    head.mockRejectedValue(new Error("Network Error"));
    renderPage("bob@example.com");
    expect(await screen.findByText("Mailboxes")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
