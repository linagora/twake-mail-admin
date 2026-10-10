// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProxyResolver } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({
  getDomainContacts: vi.fn(),
  getDomainContact: vi.fn(),
  createDomainContact: vi.fn(),
  updateDomainContact: vi.fn(),
  deleteDomainContact: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: never, pattern: string) => proxy.resolver!.isAllowed(verb, pattern),
}));
vi.mock("../api-client", () => api);
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import DomainContacts from "./domain-contacts";

// The listing is eventually consistent: it keeps answering the state prior to any write.
const STALE_LISTING = ["alice@example.com", "bob@example.com"];

beforeEach(async () => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getDomainContacts.mockResolvedValue(STALE_LISTING);
  api.createDomainContact.mockResolvedValue(undefined);
  api.deleteDomainContact.mockResolvedValue(undefined);
  proxy.resolver = new ProxyResolver([{ endpoint: "/domains/{domain}/contacts" }, { endpoint: "/domains/{domain}/contacts/*" }]);
  render(<DomainContacts domain="example.com" />);
  fireEvent.click(screen.getByText("domains.contacts.title"));
  await screen.findByText("alice@example.com");
});

afterEach(cleanup);

const counter = () => screen.getByText(/^\(\d+\)$/).textContent;

describe("domain contacts", () => {
  it("lists a created contact even though the listing is not yet up to date", async () => {
    fireEvent.click(screen.getByTitle("domains.contacts.createButton"));
    fireEvent.change(screen.getByPlaceholderText("domains.contacts.emailPlaceholder"), {
      target: { value: "carol@example.com" },
    });
    fireEvent.click(screen.getByText("common.create"));

    expect(await screen.findByText("carol@example.com")).not.toBeNull();
    expect(counter()).toBe("(3)");
    expect(api.createDomainContact).toHaveBeenCalledWith("example.com", { emailAddress: "carol@example.com" });
  });

  it("no longer lists a deleted contact even though the listing is not yet up to date", async () => {
    fireEvent.click(screen.getAllByTitle("domains.contacts.removeTooltip")[0]);

    await waitFor(() => expect(screen.queryByText("alice@example.com")).toBeNull());
    expect(screen.queryByText("bob@example.com")).not.toBeNull();
    expect(counter()).toBe("(1)");
    expect(api.deleteDomainContact).toHaveBeenCalledWith("example.com", "alice");
  });
});
