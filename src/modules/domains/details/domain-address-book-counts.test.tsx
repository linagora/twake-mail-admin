// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({
  getDomainAddressBookContactCount: vi.fn(),
  exportDomainAddressBook: vi.fn(),
  importDomainAddressBook: vi.fn(),
  clearDomainAddressBook: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("../api-client", () => api);
vi.mock("@/modules/common-tasks/api-client", () => ({}));

import DomainAddressBookCounts from "./domain-address-book-counts";

const ALL = [{ endpoint: "/domains/{domain}/addressbooks/*" }];

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
  render(<DomainAddressBookCounts domain="linagora.com" />);
}

const unfold = () => fireEvent.click(screen.getByText("domains.addressBookCounts.title"));

beforeEach(() => {
  api.getDomainAddressBookContactCount.mockReset();
  api.exportDomainAddressBook.mockReset();
  api.importDomainAddressBook.mockReset();
  api.clearDomainAddressBook.mockReset();
});

afterEach(cleanup);

describe("domain address book contact counts", () => {
  it("is folded and reads nothing until unfolded", () => {
    renderWith(ALL);

    expect(screen.queryByText("domains.addressBookCounts.dab")).toBeNull();
    expect(api.getDomainAddressBookContactCount).not.toHaveBeenCalled();
  });

  it("shows both counts, fetched for the domain, once unfolded", async () => {
    api.getDomainAddressBookContactCount.mockImplementation(async (_domain: string, id: string) =>
      ({ count: id === "dab" ? 12 : 805 })
    );
    renderWith(ALL);
    unfold();

    expect(await screen.findByText("12")).not.toBeNull();
    expect(await screen.findByText("805")).not.toBeNull();
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledWith("linagora.com", "dab");
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledWith("linagora.com", "domain-members");
  });

  it("only shows the counters the profile allows", async () => {
    api.getDomainAddressBookContactCount.mockResolvedValue({ count: 3 });
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/domain-members/contactCount" }]);
    unfold();

    expect(await screen.findByText("3")).not.toBeNull();
    expect(screen.queryByText("domains.addressBookCounts.dab")).toBeNull();
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledWith("linagora.com", "domain-members");
    expect(api.getDomainAddressBookContactCount).not.toHaveBeenCalledWith("linagora.com", "dab");
  });

  it("hides the whole section without any allowed counter", () => {
    renderWith([{ endpoint: "/domains/{domain}/settings" }]);
    expect(screen.queryByText("domains.addressBookCounts.title")).toBeNull();
    expect(api.getDomainAddressBookContactCount).not.toHaveBeenCalled();
  });

  it("offers export for both address books but import for the domain address book only", () => {
    api.getDomainAddressBookContactCount.mockResolvedValue({ count: 3 });
    renderWith(ALL);
    unfold();

    expect(screen.getAllByTitle("domains.addressBookCounts.exportTitle")).toHaveLength(2);
    expect(screen.getAllByTitle("domains.addressBookCounts.importTitle")).toHaveLength(1);
  });

  it("shows an address book the profile can only export", () => {
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/domain-members?action=export" }]);
    unfold();

    expect(screen.getByText("domains.addressBookCounts.domainMembers")).not.toBeNull();
    expect(screen.queryByText("domains.addressBookCounts.dab")).toBeNull();
    expect(screen.queryByTitle("domains.addressBookCounts.importTitle")).toBeNull();
    expect(api.getDomainAddressBookContactCount).not.toHaveBeenCalled();
  });

  it("exports the address book of the domain", async () => {
    api.exportDomainAddressBook.mockResolvedValue(new Blob([""]));
    window.URL.createObjectURL = vi.fn(() => "blob:vcf");
    window.URL.revokeObjectURL = vi.fn();
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/dab?action=export" }]);
    unfold();

    fireEvent.click(screen.getByTitle("domains.addressBookCounts.exportTitle"));

    await waitFor(() => expect(window.URL.revokeObjectURL).toHaveBeenCalled());
    expect(api.exportDomainAddressBook).toHaveBeenCalledWith("linagora.com", "dab");
  });

  it("offers to clear the domain address book only", () => {
    api.getDomainAddressBookContactCount.mockResolvedValue({ count: 3 });
    renderWith(ALL);
    unfold();

    expect(screen.getAllByTitle("domains.addressBookCounts.clear.title")).toHaveLength(1);
  });

  it("clears only once the address book id is typed", async () => {
    api.clearDomainAddressBook.mockResolvedValue({ taskId: "6d3bb34e" });
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/dab/contacts" }]);
    unfold();
    fireEvent.click(screen.getByTitle("domains.addressBookCounts.clear.title"));
    const submit = screen.getByRole("button", { name: "domains.addressBookCounts.clear.submit" }) as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("domains.addressBookCounts.clear.sourceDomain"), { target: { value: " student.school.org " } });
    fireEvent.change(screen.getByLabelText("domains.addressBookCounts.clear.confirmation"), { target: { value: "dab" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(api.clearDomainAddressBook).toHaveBeenCalledWith("linagora.com", "dab", "student.school.org"));
  });

  it("refuses an invalid source domain", () => {
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/dab/contacts" }]);
    unfold();
    fireEvent.click(screen.getByTitle("domains.addressBookCounts.clear.title"));
    fireEvent.change(screen.getByLabelText("domains.addressBookCounts.clear.sourceDomain"), { target: { value: "not a domain" } });
    fireEvent.change(screen.getByLabelText("domains.addressBookCounts.clear.confirmation"), { target: { value: "dab" } });

    expect(screen.getByText("domains.addressBookCounts.clear.invalidSourceDomain")).not.toBeNull();
    expect((screen.getByRole("button", { name: "domains.addressBookCounts.clear.submit" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
