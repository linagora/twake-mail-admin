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
const confirmFn = vi.hoisted(() => vi.fn<(options: Record<string, unknown>) => Promise<boolean>>(async () => false));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => confirmFn }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import MappingsList from "./mappings-list";

afterEach(() => {
  cleanup();
  confirmFn.mockClear();
});

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

describe("mappings list: deleting the mappings a search found", () => {
  const seeded = {
    "alice.alias@example.com": [{ type: "Alias", mapping: "alice@example.com" }],
    "brian@example.com": [{ type: "Forward", mapping: "charlotte@example.com" }],
    "qa.p1@example.com": [{ type: "Address", mapping: "bob@example.com" }],
    "qa.p2@example.com": [{ type: "Address", mapping: "bob@example.com" }],
    "qa.p3@example.com": [{ type: "Address", mapping: "bob@example.com" }],
  };
  const renderSeeded = async () => {
    api.getMappings.mockResolvedValue(seeded as never);
    render(<MemoryRouter><MappingsList /></MemoryRouter>);
    await screen.findByText("alice.alias@example.com");
  };
  const search = (value: string) =>
    fireEvent.change(screen.getByPlaceholderText("mappings.searchPlaceholder"), { target: { value } });
  const bulkButton = () => screen.queryByRole("button", { name: /mappings\.removeMatching/ });

  afterEach(() => {
    api.getMappings.mockReset();
    api.getMappings.mockResolvedValue({ "alice@example.com": [{ type: "Alias", mapping: "al@example.com" }] } as never);
    api.deleteAddressMapping.mockReset();
  });

  it("offers no bulk deletion on the unfiltered list", async () => {
    await renderSeeded();
    expect(bulkButton()).toBeNull();
  });

  it("offers it after a search, beside the total and not in the toolbar", async () => {
    await renderSeeded();
    search("qa.p");
    const button = bulkButton()!;
    expect(button).not.toBeNull();
    const toolbar = screen.getByPlaceholderText("mappings.searchPlaceholder").closest("[data-list-toolbar]")!;
    expect(toolbar.contains(button)).toBe(false);
    expect(button.parentElement!.textContent).toContain("common.totalOnly");
  });

  it("offers nothing when the search finds no mapping", async () => {
    await renderSeeded();
    search("nothing-matches");
    expect(bulkButton()).toBeNull();
  });

  it("asks to type the count, lists the rows, deletes only them and clears the search", async () => {
    await renderSeeded();
    confirmFn.mockResolvedValueOnce(true);
    search("qa.p");
    fireEvent.click(bulkButton()!);

    await vi.waitFor(() => expect(confirmFn).toHaveBeenCalled());
    const options = confirmFn.mock.calls[0][0];
    expect(options.typeToConfirm).toBe("3");
    expect(options.destructive).toBe(true);
    await vi.waitFor(() => expect(api.deleteAddressMapping).toHaveBeenCalledTimes(3));
    expect(api.deleteAddressMapping.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "qa.p1@example.com", "qa.p2@example.com", "qa.p3@example.com",
    ]);
    expect(api.deleteAliasMapping).not.toHaveBeenCalled();
    expect(api.deleteForwardMapping).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect((screen.getByPlaceholderText("mappings.searchPlaceholder") as HTMLInputElement).value).toBe(""));
  });

  it("deletes nothing when the dialog is cancelled", async () => {
    await renderSeeded();
    search("qa.p");
    fireEvent.click(bulkButton()!);
    await vi.waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(api.deleteAddressMapping).not.toHaveBeenCalled();
  });
});
