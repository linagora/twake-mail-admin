// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("./api-client", () => ({
  addMailingListMember: vi.fn(),
  addMailingListOwner: vi.fn(),
  createMailingList: vi.fn(),
  deleteMailingList: vi.fn(),
  getMailingListDetail: vi.fn(),
  getMailingLists: async () => [],
  removeMailingListMember: vi.fn(),
  removeMailingListOwner: vi.fn(),
}));

import MailingListsList from "./mailing-lists-list";

function openCreateForm() {
  render(<MailingListsList />);
  fireEvent.click(screen.getByText("mailingLists.createTitle"));
}

afterEach(cleanup);

describe("mailing lists: create form field labels", () => {
  it("names the address field after its label rather than its placeholder", () => {
    openCreateForm();

    expect(screen.getByLabelText("mailingLists.address").tagName).toBe("INPUT");
  });

  it("names the business category combobox", () => {
    openCreateForm();

    expect(screen.getByRole("combobox", { name: "mailingLists.businessCategory" })).not.toBeNull();
  });

  it("gives the members and owners inputs distinct names", () => {
    openCreateForm();

    const members = screen.getByLabelText(/^mailingLists\.members/);
    const owners = screen.getByLabelText("mailingLists.owners");

    expect(members.tagName).toBe("INPUT");
    expect(owners.tagName).toBe("INPUT");
    expect(members).not.toBe(owners);
  });
});
