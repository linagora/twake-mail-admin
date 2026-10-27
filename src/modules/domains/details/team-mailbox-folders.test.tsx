// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError, AxiosHeaders } from "axios";

const api = vi.hoisted(() => ({
  getTeamMailboxFolders: vi.fn(),
  createTeamMailboxFolder: vi.fn(),
  deleteTeamMailboxFolder: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => api);
vi.mock("./team-mailbox-folder-counts", () => ({
  default: ({ folderName }: { folderName: string }) => <span data-testid="counts">{folderName}</span>,
}));

import TeamMailboxFolders from "./team-mailbox-folders";

afterEach(cleanup);

describe("team mailbox folders", () => {
  it("hides the team mailbox root listed by WebAdmin under its bare name", async () => {
    api.getTeamMailboxFolders.mockResolvedValue([
      { mailboxName: "sales", mailboxId: "1" },
      { mailboxName: "INBOX", mailboxId: "2" },
      { mailboxName: "Sent", mailboxId: "3" },
    ]);

    render(
      <MemoryRouter>
        <TeamMailboxFolders domain="example.com" mailbox="sales" />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole("button", { name: /\(2\)/ }));

    const listed = screen.getAllByTestId("counts").map((counts) => counts.textContent);
    expect(listed).toEqual(["INBOX", "Sent"]);
  });

  it("opens the section and creates the folder named in the modal of the + button", async () => {
    api.getTeamMailboxFolders.mockResolvedValue([{ mailboxName: "INBOX", mailboxId: "2" }]);
    api.createTeamMailboxFolder.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <TeamMailboxFolders domain="example.com" mailbox="sales" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle("domains.folders.createTooltip"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("domains.folders.nameLabel"), { target: { value: "INBOX.work" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));

    expect(await screen.findByTestId("counts")).not.toBeNull();
    await waitFor(() => expect(api.createTeamMailboxFolder).toHaveBeenCalledWith("example.com", "sales", "INBOX.work"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("refuses a folder name with an empty hierarchy part before sending it", async () => {
    api.getTeamMailboxFolders.mockResolvedValue([]);
    api.createTeamMailboxFolder.mockReset();
    render(
      <MemoryRouter>
        <TeamMailboxFolders domain="example.com" mailbox="sales" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle("domains.folders.createTooltip"));
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("domains.folders.nameLabel");
    fireEvent.change(field, { target: { value: "a..b" } });

    expect(within(dialog).getByRole("alert").textContent).toBe("domains.folders.invalidName");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const create = within(dialog).getByRole("button", { name: "common.create" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.submit(create.closest("form")!);
    expect(api.createTeamMailboxFolder).not.toHaveBeenCalled();
  });

  it("keeps the modal open with the typed name when WebAdmin answers 400", async () => {
    api.getTeamMailboxFolders.mockResolvedValue([]);
    api.createTeamMailboxFolder.mockRejectedValue(
      new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        statusText: "Bad Request",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { statusCode: 400, type: "InvalidArgument", message: "Invalid folder name", details: "Mailbox name exceeds maximum size" },
      })
    );
    render(
      <MemoryRouter>
        <TeamMailboxFolders domain="example.com" mailbox="sales" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle("domains.folders.createTooltip"));
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("domains.folders.nameLabel") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "INBOX.work" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.create" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("Invalid folder name");
    expect(alert.textContent).toContain("Mailbox name exceeds maximum size");
    expect(api.createTeamMailboxFolder).toHaveBeenCalledWith("example.com", "sales", "INBOX.work");
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(field.value).toBe("INBOX.work");
  });
});
