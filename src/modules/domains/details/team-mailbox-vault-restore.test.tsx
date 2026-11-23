// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { ConfirmOptions } from "@/components/custom/confirm-provider";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toastTaskCreated: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-task-created-toast", () => ({ useTaskCreatedToast: () => mocks.toastTaskCreated }));
vi.mock("@/components/custom/confirm-provider", () => ({
  useConfirmAppearance: () => () => undefined,
  useFocusCancelOnOpen: () => undefined,
}));
vi.mock("../api-client", () => ({ restoreTeamMailboxDeletedMessages: mocks.restore }));

import TeamMailboxVaultRestore from "./team-mailbox-vault-restore";
import { teamMailboxRestoreCommand } from "./team-mailbox-vault-commands";

const confirmOptions = (): ConfirmOptions => mocks.confirm.mock.calls[0][0];

const openDialog = () => {
  render(<TeamMailboxVaultRestore domain="example.com" mailbox="sales" />);
  fireEvent.click(screen.getByRole("button", { name: "domains.teamMailbox.vaultRestore.button" }));
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.restore.mockResolvedValue({ taskId: "6d3bb34e" });
});

afterEach(cleanup);

describe("team mailbox vault restore", () => {
  it("previews a command without any body", () => {
    expect(teamMailboxRestoreCommand("example.com", "sales"))
      .toBe("curl -XPOST '/deletedMessages/teamMailbox/sales@example.com?action=restore'");
  });

  it("names the team mailbox in the dialog, and offers no criteria", () => {
    openDialog();

    const { container } = render(confirmOptions().message as ReactElement);
    expect(container.textContent).toContain('domains.teamMailbox.vaultRestore.description {"address":"sales@example.com"}');
    expect(container.textContent).toContain("confirmTask.commandLabel");
    expect(container.textContent).toContain("/deletedMessages/teamMailbox/sales@example.com?action=restore");
    expect(container.textContent).not.toContain("-d");
    expect(container.querySelector("input, select")).toBeNull();
  });

  it("restores the whole vault once confirmed, and links the task created", async () => {
    openDialog();

    await confirmOptions().action!();

    expect(mocks.restore).toHaveBeenCalledWith("example.com", "sales");
    expect(mocks.toastTaskCreated).toHaveBeenCalledWith("6d3bb34e", "users.deletedVault.restoreStarted", "taskTypes.teamMailboxRestoreDeleted");
  });

  // The confirm dialog shows a failing action and stays open
  it("lets a refusal of WebAdmin through to the dialog", async () => {
    const refusal = new Error("A body is not supported");
    mocks.restore.mockRejectedValue(refusal);
    openDialog();

    await expect(confirmOptions().action!()).rejects.toBe(refusal);
    expect(mocks.toastTaskCreated).not.toHaveBeenCalled();
  });
});
