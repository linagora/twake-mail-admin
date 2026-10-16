// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UserExistsStatus } from "@/hooks/use-check-user-exists";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  userStatus: vi.fn(),
  api: {
    createUserAddressBook: vi.fn(),
    deleteUserAddressBook: vi.fn(),
    exportUserAddressBook: vi.fn(),
    getUserAddressBookContactCount: vi.fn(),
    getUserAddressBooks: vi.fn(),
    importUserAddressBook: vi.fn(),
    setUserAddressBookPublicRight: vi.fn(),
    updateUserAddressBook: vi.fn(),
    updateUserAddressBookInvitees: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.email ? `${key} ${options.email}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: mocks.userStatus }));
vi.mock("../api-client", () => mocks.api);

import UserAddressBooks from "./user-address-books";

const ALICE = "alice@example.com";
const BOB = "bob@example.com";

const typeSharee = async (sharee: string, status: UserExistsStatus) => {
  mocks.userStatus.mockReturnValue(status);
  render(<UserAddressBooks username={ALICE} />);
  fireEvent.click(screen.getByText("users.addressBooks.title"));
  fireEvent.click(await screen.findByTitle("users.addressBooks.invitees.title"));
  fireEvent.change(shareeInput(), { target: { value: sharee } });
};

const shareeInput = () => screen.getByPlaceholderText("users.addressBooks.invitees.placeholder");

const stageButton = () => shareeInput().parentElement!.querySelector("button")!;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getUserAddressBooks.mockResolvedValue({
    _embedded: {
      "dav:addressbook": [{ _links: { self: { href: "/addressbooks/abc/contacts.json" } }, "dav:name": "Contacts" }],
    },
  });
});

afterEach(cleanup);

describe("address book sharing: stage a sharee", () => {
  it("refuses to share the address book with its owner", async () => {
    await typeSharee(" ALICE@example.com ", "exists");

    expect(screen.getByText("users.addressBooks.invitees.isOwner")).toBeTruthy();
    expect(screen.queryByText("common.userExists")).toBeNull();
    expect(stageButton().disabled).toBe(true);
    fireEvent.keyDown(shareeInput(), { key: "Enter" });
    expect(screen.queryByText(ALICE)).toBeNull();
  });

  it("stages another existing user", async () => {
    await typeSharee(BOB, "exists");

    expect(screen.getByText("common.userExists")).toBeTruthy();
    expect(stageButton().disabled).toBe(false);
    fireEvent.click(stageButton());

    await waitFor(() => expect(screen.getByText(BOB)).toBeTruthy());
  });
});

describe("address book dialogs: field labels", () => {
  const openSection = async () => {
    mocks.userStatus.mockReturnValue("idle");
    mocks.api.getUserAddressBookContactCount.mockResolvedValue({ count: 0 });
    mocks.api.getUserAddressBooks.mockResolvedValue({
      _embedded: {
        "dav:addressbook": [{
          "dav:name": "Friends",
          _links: { self: { href: "/addressbooks/bob/friends.json" } },
          invite: [{ href: "mailto:alice@example.com", principal: "principals/users/alice", access: 2 }],
        }],
      },
    });
    render(<UserAddressBooks username={BOB} />);
    fireEvent.click(screen.getByText("users.addressBooks.title"));
    await screen.findByText("Friends");
  };

  it.each(["users.addressBooks.name", "users.addressBooks.description"])(
    "names the %s field of the create dialog",
    async (label) => {
      await openSection();
      fireEvent.click(screen.getByTitle("users.addressBooks.createTitle"));

      expect(screen.getByLabelText(label, { exact: false }).tagName).toBe("INPUT");
    },
  );

  it.each(["users.addressBooks.name", "users.addressBooks.description"])(
    "names the %s field of the edit dialog",
    async (label) => {
      await openSection();
      fireEvent.click(screen.getByTitle("users.addressBooks.editTitle"));

      expect(screen.getByLabelText(label, { exact: false }).tagName).toBe("INPUT");
    },
  );

  it("names the right selects and the add button of the sharing dialog", async () => {
    await openSection();
    fireEvent.click(screen.getByTitle("users.addressBooks.invitees.title"));

    expect(screen.getByRole("combobox", { name: "users.addressBooks.invitees.rightOf alice@example.com" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "users.addressBooks.invitees.email" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "users.addressBooks.invitees.right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "users.addressBooks.invitees.add" })).toBeTruthy();
  });
});
