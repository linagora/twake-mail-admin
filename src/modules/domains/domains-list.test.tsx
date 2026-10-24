// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const confirm = vi.hoisted(() => vi.fn<(options: Record<string, unknown>) => Promise<boolean>>(async () => false));
const getUsers = vi.hoisted(() => vi.fn());
const getDomainAliases = vi.hoisted(() => vi.fn());
const deleteDomain = vi.hoisted(() => vi.fn());
const removeDomainAlias = vi.hoisted(() => vi.fn());
vi.mock("@/modules/users/api-client", () => ({ listUsernames: getUsers }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => confirm }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock("./api-client", () => ({
  getDomains: vi.fn(async () => ["example.com", "example.org"]),
  createDomain: vi.fn(),
  deleteDomain,
  getDomainAliases,
  removeDomainAlias,
}));

import DomainsList from "./domains-list";

async function renderList() {
  render(
    <MemoryRouter>
      <DomainsList />
    </MemoryRouter>
  );
  await screen.findByText("example.com");
}

function search(query: string) {
  fireEvent.change(screen.getByPlaceholderText("domains.searchPlaceholder"), { target: { value: query } });
}

afterEach(() => {
  cleanup();
  confirm.mockClear();
});

describe("domains list: search", () => {
  it("lists the matching domains without an empty-state message", async () => {
    await renderList();
    search("ORG");
    expect(screen.getByText("example.org")).not.toBeNull();
    expect(screen.queryByText("example.com")).toBeNull();
    expect(screen.queryByText("domains.noMatch")).toBeNull();
  });

  it("tells when no domain matches the search", async () => {
    await renderList();
    search("zzz");
    expect(screen.getByText("domains.noMatch")).not.toBeNull();
    expect(screen.queryByText("example.com")).toBeNull();
  });

  it("restores the list when the search is cleared", async () => {
    await renderList();
    search("zzz");
    search("");
    expect(screen.getByText("example.com")).not.toBeNull();
    expect(screen.queryByText("domains.noMatch")).toBeNull();
  });
});

describe("domains list: one toolbar line", () => {
  it("puts the search, Create a domain and Import on the same line", async () => {
    await renderList();
    const searchField = screen.getByPlaceholderText("domains.searchPlaceholder");
    const toolbar = searchField.closest("[data-list-toolbar]")!;
    expect(toolbar.contains(screen.getByRole("button", { name: "domains.createButton" }))).toBe(true);
    expect(toolbar.contains(screen.getByRole("button", { name: "domains.import.button" }))).toBe(true);
  });

  it("creates a domain from its modal, Enter included", async () => {
    const { createDomain } = await import("./api-client");
    await renderList();
    fireEvent.click(screen.getByRole("button", { name: "domains.createButton" }));
    const field = screen.getByLabelText("domains.domainName");
    fireEvent.change(field, { target: { value: "qa-create.org" } });

    fireEvent.submit(field.closest("form")!);

    await vi.waitFor(() => expect(createDomain).toHaveBeenCalledWith("qa-create.org"));
  });
});

describe("domains list: delete tells what the domain still holds", () => {
  const openDelete = async (domain: string) => {
    await renderList();
    const row = screen.getByText(domain).closest("li")!;
    fireEvent.click(row.querySelector("button")!);
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    return confirm.mock.calls[0][0];
  };

  it("keeps one confirmation for an empty domain, even when the backend lists the users of other domains", async () => {
    getUsers.mockResolvedValue(["olivia@example.org"]);
    getDomainAliases.mockResolvedValue([]);
    const options = await openDelete("example.com");
    expect(options.typeToConfirm).toBeUndefined();
    expect(options.consequence).toBeUndefined();
    render(<>{options.message as never}</>);
    expect(screen.getByText("domains.deleteConfirm")).not.toBeNull();
  });

  it("states the users and aliases left and asks to type the domain", async () => {
    // Users of other domains too: a backend ignoring the domain parameter
    getUsers.mockResolvedValue(["olivia@example.org", "oscar@example.org", "alice@example.com"]);
    getDomainAliases.mockResolvedValue([{ source: "example.net" }]);
    const options = await openDelete("example.org");
    expect(options.typeToConfirm).toBe("example.org");
    expect(options.typeToConfirmIgnoreCase).toBe(true);
    expect(getUsers).toHaveBeenCalledWith({ domain: "example.org", limit: 51 });
    cleanup();
    render(<MemoryRouter>{options.consequence as never}{options.message as never}</MemoryRouter>);
    expect(screen.getByText(/domains.delete.stillBoth/)).not.toBeNull();
    expect(screen.getByRole("link", { name: "domains.delete.seeUsers" }).getAttribute("href")).toBe("/users?domain=example.org");
  });

  it("removes the domain aliases before the domain, and says so", async () => {
    getUsers.mockResolvedValue([]);
    getDomainAliases.mockResolvedValue([{ source: "example.net" }, { source: "example.info" }]);
    const calls: string[] = [];
    removeDomainAlias.mockImplementation(async (domain: string, alias: string) => { calls.push(`alias ${alias} -> ${domain}`); });
    deleteDomain.mockImplementation(async (domain: string) => { calls.push(`domain ${domain}`); });
    confirm.mockResolvedValueOnce(true);
    const options = await openDelete("example.org");
    await vi.waitFor(() => expect(calls).toEqual(["alias example.net -> example.org", "alias example.info -> example.org", "domain example.org"]));
    cleanup();
    render(<MemoryRouter>{options.message as never}</MemoryRouter>);
    expect(screen.getByText("domains.delete.aliasesRemoved")).not.toBeNull();
  });

  it("still opens the dialog, saying it could not check, when the lookup fails", async () => {
    getUsers.mockRejectedValue(new Error("boom"));
    getDomainAliases.mockResolvedValue([]);
    const options = await openDelete("example.com");
    render(<>{options.message as never}</>);
    expect(screen.getByText("domains.delete.couldNotCheck")).not.toBeNull();
  });
});

describe("domains list: compact and accessible", () => {
  it("lists the domains as list items, without headings", async () => {
    await renderList();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1.example.com", "2.example.org"]);
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
  });
});
