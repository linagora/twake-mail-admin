// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-router", () => ({ Link: () => null }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import UserDeletedMessageVault from "./user-deleted-message-vault";
import { DeletedMessage } from "../types";

afterEach(cleanup);

const deletedMessage: DeletedMessage = {
  messageId: "message-1",
  originMailboxes: ["INBOX"],
  owner: "alice@example.com",
  deliveryDate: "2026-01-01T10:00:00Z",
  deletionDate: "2026-01-02T10:00:00Z",
  sender: "bob@example.com",
  recipients: ["alice@example.com"],
  subject: "Hello",
  hasAttachment: false,
  size: 1024,
};

const renderVault = (searchResults: DeletedMessage[] = []) => {
  render(
    <UserDeletedMessageVault
      label="alice@example.com"
      onSearch={vi.fn().mockResolvedValue(searchResults)}
      onRestore={vi.fn()}
    />
  );
  fireEvent.click(screen.getByText("users.deletedVault.title"));
};

const searchButton = () => screen.getByRole("button", { name: "users.deletedVault.search" }) as HTMLButtonElement;
// The toolbar Restore button comes first; result rows carry their own Restore button with the same label.
const restoreButton = () => screen.getAllByRole("button", { name: "users.deletedVault.restore" })[0] as HTMLButtonElement;

describe("user deleted message vault", () => {
  it("enables Search and Restore when no criterion is displayed", () => {
    renderVault();

    expect(searchButton().disabled).toBe(false);
    expect(restoreButton().disabled).toBe(false);
  });

  it("disables Search and Restore while a displayed criterion is incomplete", () => {
    renderVault();

    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    expect(searchButton().disabled).toBe(true);
    expect(restoreButton().disabled).toBe(true);
  });

  it("disables Restore once a search found no message", async () => {
    renderVault();

    fireEvent.click(searchButton());

    await waitFor(() => expect(screen.getByText("users.deletedVault.empty")).toBeTruthy());
    expect(restoreButton().disabled).toBe(true);
  });

  it("keeps Restore enabled when a search found messages", async () => {
    renderVault([deletedMessage]);

    fireEvent.click(searchButton());

    await waitFor(() => expect(screen.getByText(deletedMessage.messageId)).toBeTruthy());
    expect(restoreButton().disabled).toBe(false);
  });

  it("enables Restore again when criteria change after an empty search", async () => {
    renderVault();

    fireEvent.click(searchButton());
    await waitFor(() => expect(screen.getByText("users.deletedVault.empty")).toBeTruthy());
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });

    expect(restoreButton().disabled).toBe(false);
  });

  it("only browses the vault without onRestore: no Restore of the criteria nor of a message", async () => {
    render(
      <UserDeletedMessageVault
        label="sales@example.com"
        onSearch={vi.fn().mockResolvedValue([deletedMessage])}
        criteriaDescription="search only"
        intro={<button type="button">restore all</button>}
      />
    );
    fireEvent.click(screen.getByText("users.deletedVault.title"));

    expect(screen.getByRole("button", { name: "restore all" })).toBeTruthy();
    expect(screen.getByText("search only")).toBeTruthy();
    fireEvent.click(searchButton());
    await waitFor(() => expect(screen.getByText(deletedMessage.messageId)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "users.deletedVault.restore" })).toBeNull();
  });
});
