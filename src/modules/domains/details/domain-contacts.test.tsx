// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProxyResolver } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({
  getDomainContacts: vi.fn(),
  getDomainContact: vi.fn(),
  createDomainContact: vi.fn(),
  updateDomainContact: vi.fn(),
  deleteDomainContact: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
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
  it("creates the contact typed in the modal of the + button", async () => {
    fireEvent.click(screen.getByTitle("domains.contacts.createButton"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("domains.contacts.email"), { target: { value: "carol@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("domains.contacts.surname"), { target: { value: "Doe" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));

    await waitFor(() =>
      expect(api.createDomainContact).toHaveBeenCalledWith("example.com", { emailAddress: "carol@example.com", surname: "Doe" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the modal open with the typed address when the creation is refused", async () => {
    api.createDomainContact.mockRejectedValue(new Error("Contact already exists"));
    fireEvent.click(screen.getByTitle("domains.contacts.createButton"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("domains.contacts.email"), { target: { value: "alice@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));

    expect(await within(dialog).findByText("Contact already exists")).not.toBeNull();
    expect((within(dialog).getByLabelText("domains.contacts.email") as HTMLInputElement).value).toBe("alice@example.com");
  });

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

  it("exposes each contact address as a keyboard reachable button opening its details", async () => {
    api.getDomainContact.mockResolvedValue({ id: "a902d35d", emailAddress: "alice@example.com" });
    const contactButton = screen.getByRole("button", { name: "alice@example.com" });
    contactButton.focus();
    expect(document.activeElement).toBe(contactButton);

    fireEvent.click(contactButton);

    expect(await screen.findByRole("dialog")).not.toBeNull();
    expect(api.getDomainContact).toHaveBeenCalledTimes(1);
    expect(api.getDomainContact).toHaveBeenCalledWith("example.com", "alice");
  });

  it("returns the focus to the contact address that opened the details once they are closed", async () => {
    api.getDomainContact.mockResolvedValue({ id: "a902d35d", emailAddress: "alice@example.com" });
    const contactButton = screen.getByRole("button", { name: "alice@example.com" });
    contactButton.focus();
    fireEvent.click(contactButton);
    await screen.findByText("a902d35d");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Radix moves the focus on close from a timeout
    await waitFor(() => expect(document.activeElement).toBe(contactButton));
  });

  it("names the edit and remove buttons of each row after its contact, the tooltips staying short", () => {
    const labels = (pattern: RegExp) => screen.getAllByRole("button", { name: pattern }).map((button) => button.getAttribute("aria-label"));
    const named = (key: string) => STALE_LISTING.map((email) => `domains.contacts.${key} ${JSON.stringify({ item: email })}`);

    expect(labels(/^domains\.contacts\.editNamed /)).toEqual(named("editNamed"));
    expect(labels(/^domains\.contacts\.removeNamed /)).toEqual(named("removeNamed"));
    expect(screen.getAllByTitle("domains.contacts.editTooltip")).toHaveLength(STALE_LISTING.length);
    expect(screen.getAllByTitle("domains.contacts.removeTooltip")).toHaveLength(STALE_LISTING.length);
  });
});
