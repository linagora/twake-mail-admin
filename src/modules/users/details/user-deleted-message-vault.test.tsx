// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-router", () => ({ Link: () => null }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import UserDeletedMessageVault from "./user-deleted-message-vault";

afterEach(cleanup);

const renderVault = () => {
  render(
    <UserDeletedMessageVault
      label="alice@example.com"
      onSearch={vi.fn().mockResolvedValue([])}
      onRestore={vi.fn()}
    />
  );
  fireEvent.click(screen.getByText("users.deletedVault.title"));
};

const searchButton = () => screen.getByRole("button", { name: "users.deletedVault.search" }) as HTMLButtonElement;
const restoreButton = () => screen.getByRole("button", { name: "users.deletedVault.restore" }) as HTMLButtonElement;

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
});
