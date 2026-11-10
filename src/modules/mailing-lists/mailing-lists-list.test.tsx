// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
const lists = vi.hoisted(() => ({ get: async (): Promise<string[]> => [] }));
vi.mock("./api-client", () => ({
  getMailingLists: () => lists.get(),
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
    fireEvent.click(screen.getByRole("button", { name: "mailingLists.createButton" }));

    expect(screen.getByLabelText(label, { exact: false }).tagName).toBe(tagName);
  });
});


describe("mailing lists: extension absent from the server", () => {
  const axiosError = (status: number) =>
    Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data: {} } });

  afterEach(() => { lists.get = async () => []; });

  it("explains that mailing lists are not available, without form nor table, on a 404", async () => {
    lists.get = () => Promise.reject(axiosError(404));
    render(<MailingListsList />);

    expect(await screen.findByText("mailingLists.unavailableTitle")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "mailingLists.createButton" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("common.errorPrefix")).toBeNull();
  });

  it("keeps the red error on a 500", async () => {
    lists.get = () => Promise.reject(axiosError(500));
    render(<MailingListsList />);

    expect(await screen.findByText("common.errorPrefix")).not.toBeNull();
    expect(screen.queryByText("mailingLists.unavailableTitle")).toBeNull();
  });

  it("shows the error alone on a 500, without table nor empty state", async () => {
    lists.get = () => Promise.reject(axiosError(500));
    render(<MailingListsList />);

    expect(await screen.findByText("common.errorPrefix")).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("mailingLists.empty")).toBeNull();
  });
});

describe("mailing lists: one toolbar line", () => {
  it("puts the search and Create a mailing list on one line", () => {
    render(<MailingListsList />);
    const toolbar = screen.getByPlaceholderText("mailingLists.searchPlaceholder").closest("[data-list-toolbar]")!;
    expect(toolbar.contains(screen.getByRole("button", { name: "mailingLists.createButton" }))).toBe(true);
  });
});
