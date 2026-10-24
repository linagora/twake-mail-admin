// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({
  getMappings: vi.fn(async () => ({ "alice@example.com": [{ type: "Alias", mapping: "al@example.com" }] })),
  createAddressMapping: vi.fn(async () => undefined),
  createDomainMapping: vi.fn(),
  createRegexMapping: vi.fn(),
  deleteAddressMapping: vi.fn(),
  deleteAliasMapping: vi.fn(),
  deleteForwardMapping: vi.fn(),
  deleteGroupMapping: vi.fn(),
  deleteDomainMapping: vi.fn(),
  deleteRegexMapping: vi.fn(),
}));
vi.mock("./api-client", () => api);
const accounts = vi.hoisted(() => new Set<string>());
vi.mock("@/hooks/use-check-user-exists", () => ({
  useCheckUserExists: (value: string) => (!value.trim() ? "idle" : accounts.has(value.trim()) ? "exists" : "not_found"),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import MappingsList from "./mappings-list";

afterEach(cleanup);

describe("mappings list: one toolbar line", () => {
  it("puts the search and one Add button on one line, the kind chosen in the modal", async () => {
    render(<MemoryRouter><MappingsList /></MemoryRouter>);
    await screen.findByText("alice@example.com");
    const toolbar = screen.getByPlaceholderText("mappings.searchPlaceholder").closest("[data-list-toolbar]")!;
    const add = screen.getByRole("button", { name: "mappings.addTitle" });
    expect(toolbar.contains(add)).toBe(true);

    fireEvent.click(add);
    expect(Array.from((screen.getByLabelText("mappings.type") as HTMLSelectElement).options).map((o) => o.value)).toEqual(["address", "regex", "domain"]);
    fireEvent.change(screen.getByLabelText("mappings.source"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("mappings.destination"), { target: { value: "b@example.com" } });
    fireEvent.submit(screen.getByLabelText("mappings.source").closest("form")!);

    await vi.waitFor(() => expect(api.createAddressMapping).toHaveBeenCalledWith("a@example.com", "b@example.com"));
  });
});

describe("mappings list: a forward kept as a copy", () => {
  it("names the forward of an address to itself as a kept copy", async () => {
    api.getMappings.mockResolvedValueOnce({
      "bob@example.com": [{ type: "Forward", mapping: "bob@example.com" }, { type: "Forward", mapping: "emma@example.com" }],
    } as never);
    render(<MemoryRouter><MappingsList /></MemoryRouter>);

    expect(await screen.findByText("mappings.forwardCopyKept")).not.toBeNull();
    expect(screen.getAllByText("Forward")).toHaveLength(1);
  });

  it("finds a kept copy by the type its row reads", async () => {
    api.getMappings.mockResolvedValueOnce({
      "bob@example.com": [{ type: "Forward", mapping: "bob@example.com" }, { type: "Forward", mapping: "emma@example.com" }],
    } as never);
    render(<MemoryRouter><MappingsList /></MemoryRouter>);
    await screen.findByText("mappings.forwardCopyKept");

    fireEvent.change(screen.getByPlaceholderText("mappings.searchPlaceholder"), { target: { value: "CopyKept" } });

    expect(screen.getByText("mappings.forwardCopyKept")).not.toBeNull();
    expect(screen.queryByText("Forward")).toBeNull();
  });
});

describe("mappings list: an address mapping checks its addresses", () => {
  const openAddressDialog = async () => {
    render(<MemoryRouter><MappingsList /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "mappings.addTitle" }));
  };
  const typeAddresses = (source: string, destination: string) => {
    fireEvent.change(screen.getByLabelText("mappings.source"), { target: { value: source } });
    fireEvent.change(screen.getByLabelText("mappings.destination"), { target: { value: destination } });
  };

  it("refuses a source that is an existing account, naming where its mail would go", async () => {
    accounts.add("charlotte@example.com");
    await openAddressDialog();
    typeAddresses("charlotte@example.com", "bob@example.com");

    expect(screen.getByRole("alert").textContent).toBe("common.sourceIsAccount");
    expect((screen.getByRole("button", { name: "common.create" }) as HTMLButtonElement).disabled).toBe(true);
    accounts.clear();
  });

  it("tells whether the destination is a local account, without blocking", async () => {
    accounts.add("bob@example.com");
    await openAddressDialog();
    typeAddresses("qa.map@example.com", "bob@example.com");
    expect(screen.getByText("common.userExists")).not.toBeNull();

    typeAddresses("qa.map@example.com", "someone@external.test");
    expect(screen.getByText("mappings.destinationExternal")).not.toBeNull();
    expect((screen.getByRole("button", { name: "common.create" }) as HTMLButtonElement).disabled).toBe(false);
    accounts.clear();
  });
});
