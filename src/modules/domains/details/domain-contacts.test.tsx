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
  getTeamMailboxes: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

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
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router";
import DomainContacts from "./domain-contacts";

// The listing is eventually consistent: it keeps answering the state prior to any write.
const STALE_LISTING = ["alice@example.com", "bob@example.com"];
const CONTACT_ENDPOINTS = [{ endpoint: "/domains/{domain}/contacts" }, { endpoint: "/domains/{domain}/contacts/*" }];
const TEAM_MAILBOX_ENDPOINTS = [{ endpoint: "/domains/{domain}/team-mailboxes" }];

const renderContacts = async (endpoints: { endpoint: string }[]) => {
  cleanup();
  proxy.resolver = new ProxyResolver(endpoints);
  render(<MemoryRouter><DomainContacts domain="example.com" /></MemoryRouter>);
  fireEvent.click(screen.getByText("domains.contacts.title"));
  await screen.findByText("alice@example.com");
};

const conflict = (message: string) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed with status code 409", "ERR_BAD_REQUEST", config, null, {
    status: 409, statusText: "Conflict", headers: {}, config, data: { statusCode: 409, message },
  });
};

beforeEach(async () => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.mockReset();
  api.getDomainContacts.mockResolvedValue(STALE_LISTING);
  api.createDomainContact.mockResolvedValue(undefined);
  api.deleteDomainContact.mockResolvedValue(undefined);
  api.getTeamMailboxes.mockResolvedValue([]);
  await renderContacts(CONTACT_ENDPOINTS);
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

describe("domain contacts of the team mailboxes", () => {
  const removeButtonOf = (email: string) =>
    screen.getByRole("button", { name: `domains.contacts.removeNamed ${JSON.stringify({ item: email })}` }) as HTMLButtonElement;

  it("marks the contact of a team mailbox and does not offer its deletion, saying why", async () => {
    api.getTeamMailboxes.mockResolvedValue([{ name: "sales", emailAddress: "Alice@example.com" }]);
    await renderContacts([...CONTACT_ENDPOINTS, ...TEAM_MAILBOX_ENDPOINTS]);

    const badge = await screen.findByRole("link", { name: `domains.contacts.teamMailbox.badgeNamed ${JSON.stringify({ name: "sales" })}` });
    expect(badge.getAttribute("href")).toBe("/domains/domain/example.com/team-mailbox/sales");
    const aliceRemove = removeButtonOf("alice@example.com");
    expect(aliceRemove.disabled).toBe(true);
    const hint = `domains.contacts.teamMailbox.undeletable ${JSON.stringify({ name: "Alice@example.com" })}`;
    expect(document.getElementById(aliceRemove.getAttribute("aria-describedby")!)?.textContent).toBe(hint);
    expect(removeButtonOf("bob@example.com").disabled).toBe(false);

    fireEvent.click(aliceRemove.parentElement!);
    expect(api.deleteDomainContact).not.toHaveBeenCalled();
  });

  it("does not look the team mailboxes up without the permission to list them", () => {
    expect(api.getTeamMailboxes).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("reports the refusal to delete the contact of a team mailbox, and keeps it listed", async () => {
    api.deleteDomainContact.mockRejectedValue(conflict("Contact alice@example.com belongs to a team mailbox"));
    fireEvent.click(removeButtonOf("alice@example.com"));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0].title).toBe("domains.contacts.teamMailbox.deleteRefused");
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "domains.contacts.deleted" }));
    expect(screen.queryByText("alice@example.com")).not.toBeNull();
    expect(counter()).toBe("(2)");
  });
});

describe("domain contacts following the team mailboxes of the page", () => {
  const renderWithChange = (teamMailboxChange: { added?: string; removed?: string } | null) => (
    <MemoryRouter><DomainContacts domain="example.com" teamMailboxChange={teamMailboxChange} /></MemoryRouter>
  );

  const renderFollowing = async () => {
    cleanup();
    proxy.resolver = new ProxyResolver([...CONTACT_ENDPOINTS, ...TEAM_MAILBOX_ENDPOINTS]);
    const view = render(renderWithChange(null));
    fireEvent.click(screen.getByText("domains.contacts.title"));
    await screen.findByText("alice@example.com");
    return view.rerender;
  };

  it("drops the contact of a deleted team mailbox, although the listing still has it, and fetches the badges again", async () => {
    api.getDomainContacts.mockResolvedValue([...STALE_LISTING, "qateam2@example.com"]);
    api.getTeamMailboxes.mockResolvedValue([{ name: "qateam2", emailAddress: "qateam2@example.com" }]);
    const rerender = await renderFollowing();
    expect(counter()).toBe("(3)");
    api.getTeamMailboxes.mockClear();

    api.getTeamMailboxes.mockResolvedValue([]);
    rerender(renderWithChange({ removed: "qateam2@example.com" }));

    await waitFor(() => expect(screen.queryByText("qateam2@example.com")).toBeNull());
    expect(counter()).toBe("(2)");
    expect(api.getTeamMailboxes).toHaveBeenCalledTimes(1);
  });

  it("lists the contact of a created team mailbox before the listing has it", async () => {
    const rerender = await renderFollowing();
    rerender(renderWithChange({ added: "qateam3@example.com" }));

    expect(await screen.findByText("qateam3@example.com")).not.toBeNull();
    expect(counter()).toBe("(3)");
  });
});
