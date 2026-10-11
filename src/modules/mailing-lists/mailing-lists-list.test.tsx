// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("./api-client", () => ({
  getMailingLists: async () => [],
  getMailingListDetail: vi.fn(),
  createMailingList: vi.fn(),
  deleteMailingList: vi.fn(),
  addMailingListMember: vi.fn(),
  addMailingListOwner: vi.fn(),
  removeMailingListMember: vi.fn(),
  removeMailingListOwner: vi.fn(),
}));

import MailingListsList from "./mailing-lists-list";

afterEach(cleanup);

describe("create mailing list form: field labels", () => {
  it.each([
    ["mailingLists.address", "INPUT"],
    ["mailingLists.businessCategory", "BUTTON"],
    ["mailingLists.members", "INPUT"],
    ["mailingLists.owners", "INPUT"],
  ])("names the %s field after its visible label", (label, tagName) => {
    render(<MailingListsList />);
    fireEvent.click(screen.getByText("mailingLists.createTitle"));

    expect(screen.getByLabelText(label, { exact: false }).tagName).toBe(tagName);
  });
});
