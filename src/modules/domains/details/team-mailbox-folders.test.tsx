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
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("../api-client", () => api);
vi.mock("./team-mailbox-folder-counts", () => ({
  default: ({ folderName }: { folderName: string }) => <span data-testid="counts">{folderName}</span>,
}));

import TeamMailboxFolders from "./team-mailbox-folders";

afterEach(cleanup);

const webAdminBadRequest = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 400, type: "InvalidArgument", message },
  });

const renderOpenFolders = async (folders: { mailboxName: string; mailboxId: string }[]) => {
  api.getTeamMailboxFolders.mockResolvedValue(folders);
  render(
    <MemoryRouter>
      <TeamMailboxFolders domain="example.com" mailbox="sales" />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`\\(${folders.length}\\)`) }));
};

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

  it("refuses a folder name with a hierarchy part starting with the namespace prefix", async () => {
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
    fireEvent.change(field, { target: { value: "INBOX.#user" } });

    expect(within(dialog).getByRole("alert").textContent).toBe("domains.folders.namespacePrefixName");
    const create = within(dialog).getByRole("button", { name: "common.create" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.submit(create.closest("form")!);
    expect(api.createTeamMailboxFolder).not.toHaveBeenCalled();
  });

  it("disables the Delete action of the system folders, not of their sub-folders", async () => {
    await renderOpenFolders([
      { mailboxName: "INBOX", mailboxId: "2" },
      { mailboxName: "INBOX.work", mailboxId: "3" },
      { mailboxName: "Templates", mailboxId: "4" },
    ]);

    const deleteButtons = screen.getAllByRole("button", { name: "domains.folders.deleteNamed" }) as HTMLButtonElement[];
    expect(deleteButtons.map((button) => button.disabled)).toEqual([true, false, true]);
    expect(screen.getAllByText("domains.folders.systemFolder")).toHaveLength(2);
  });

  it("reports in an error toast the refusal of WebAdmin to delete a folder", async () => {
    api.deleteTeamMailboxFolder.mockRejectedValue(webAdminBadRequest("Cannot delete system folder Archive"));
    toast.mockReset();
    await renderOpenFolders([{ mailboxName: "Archive", mailboxId: "2" }]);

    fireEvent.click(screen.getByRole("button", { name: "domains.folders.deleteNamed" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "domains.folders.errorDeleting", variant: "destructive" })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "domains.folders.deleted" }));
    render(<>{toast.mock.calls[0][0].description}</>);
    expect(screen.getByText(/Cannot delete system folder Archive/)).not.toBeNull();
  });
});
