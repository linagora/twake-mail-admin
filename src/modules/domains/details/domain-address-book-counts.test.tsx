// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({ getDomainAddressBookContactCount: vi.fn() }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("../api-client", () => api);

import DomainAddressBookCounts from "./domain-address-book-counts";

const ALL = [{ endpoint: "/domains/{domain}/addressbooks/%/contactCount" }];

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
  render(<DomainAddressBookCounts domain="linagora.com" />);
}

beforeEach(() => {
  api.getDomainAddressBookContactCount.mockReset();
});

afterEach(cleanup);

describe("domain address book contact counts", () => {
  it("shows both counts, fetched for the domain", async () => {
    api.getDomainAddressBookContactCount.mockImplementation(async (_domain: string, id: string) =>
      ({ count: id === "dab" ? 12 : 805 })
    );
    renderWith(ALL);

    expect(await screen.findByText("12")).not.toBeNull();
    expect(await screen.findByText("805")).not.toBeNull();
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledWith("linagora.com", "dab");
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledWith("linagora.com", "domain-members");
  });

  it("says the address book is not available on 404 and warns on other errors", async () => {
    api.getDomainAddressBookContactCount.mockImplementation(async (_domain: string, id: string) => {
      throw httpError(id === "dab" ? 404 : 500);
    });
    renderWith(ALL);

    expect(await screen.findByText("domains.addressBookCounts.unavailable")).not.toBeNull();
    expect(await screen.findByText("domains.addressBookCounts.error")).not.toBeNull();
  });

  it("re-reads the counts on refresh", async () => {
    api.getDomainAddressBookContactCount.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 2 });
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/dab/contactCount" }]);
    expect(await screen.findByText("1")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("domains.addressBookCounts.refresh"));

    expect(await screen.findByText("2")).not.toBeNull();
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledTimes(2);
  });

  it("only shows the counters the profile allows", async () => {
    api.getDomainAddressBookContactCount.mockResolvedValue({ count: 3 });
    renderWith([{ endpoint: "/domains/{domain}/addressbooks/domain-members/contactCount" }]);

    expect(await screen.findByText("3")).not.toBeNull();
    expect(screen.queryByText("domains.addressBookCounts.dab:")).toBeNull();
    expect(api.getDomainAddressBookContactCount).toHaveBeenCalledWith("linagora.com", "domain-members");
    expect(api.getDomainAddressBookContactCount).not.toHaveBeenCalledWith("linagora.com", "dab");
  });

  it("hides the whole block without any allowed counter", () => {
    renderWith([{ endpoint: "/domains/{domain}/settings" }]);
    expect(screen.queryByText("domains.addressBookCounts.title")).toBeNull();
    expect(api.getDomainAddressBookContactCount).not.toHaveBeenCalled();
  });
});
