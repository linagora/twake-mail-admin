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
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (method: string, path: string) =>
    (method === "GET" && path === "/users/{username}/addressbooks") || path.endsWith("/invitee"),
}));
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
