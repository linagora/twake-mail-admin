// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError } from "axios";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL", mode: "DOMAIN", sso: null } }));
interface DialogOptions {
  message: unknown;
  validate?: () => string | null;
  action?: () => Promise<void>;
  describeError?: (error: unknown) => ReactNode | null;
}
const dialog = vi.hoisted(() => ({ message: null as unknown, options: undefined as DialogOptions | undefined }));
vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => async (options: DialogOptions) => {
    dialog.message = options.message;
    dialog.options = options;
    return false;
  },
}));
const api = vi.hoisted(() => ({ reindexUserMailboxes: vi.fn() }));
vi.mock("../api-client", () => api);

import UserTasks from "./user-tasks";

function renderWith(rules: ProxyRule[]) {
  renderWithResolver(new ProxyResolver(rules));
}

function renderWithResolver(resolver: NonNullable<typeof proxy.resolver>) {
  proxy.resolver = resolver;
  render(
    <MemoryRouter>
      <UserTasks username="bob@linagora.com" />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText("common.tasks"));
}

afterEach(cleanup);

describe("user tasks: cleanup mailbox gates", () => {
  it("shows both cleanup buttons with the user-scoped baseline rule", () => {
    renderWith([{ endpoint: "/messages?user=%@{domain}" }]);
    expect(screen.queryByText("users.tasks.cleanupTrash")).not.toBeNull();
    expect(screen.queryByText("users.tasks.cleanupSpam")).not.toBeNull();
  });

  it("shows both cleanup buttons with the baseline's DELETE-only rule behind its POST /messages deny", () => {
    renderWith([
      { denied: true, verb: ["POST"], endpoint: "/messages" },
      { verb: ["DELETE"], endpoint: "/messages?user=%@{domain}" },
    ]);
    expect(screen.queryByText("users.tasks.cleanupTrash")).not.toBeNull();
    expect(screen.queryByText("users.tasks.cleanupSpam")).not.toBeNull();
  });

  it("hides them without a rule covering the user-scoped call", () => {
    renderWith([{ endpoint: "/users/%@{domain}" }, { endpoint: "/messages?user=%@{domain}&mailbox=Inbox" }]);
    expect(screen.queryByText("users.tasks.cleanupTrash")).toBeNull();
    expect(screen.queryByText("users.tasks.cleanupSpam")).toBeNull();
  });

  it("follows the proxy on a platform-wide mailbox rule: parameters it does not list are ignored", () => {
    // /messages?mailbox=Trash lets DELETE /messages?user=…&mailbox=Trash through: the rule, not
    // the gate, is what must not be granted to a tenant admin.
    renderWith([{ endpoint: "/messages?mailbox=Trash" }]);
    expect(screen.queryByText("users.tasks.cleanupTrash")).not.toBeNull();
    expect(screen.queryByText("users.tasks.cleanupSpam")).toBeNull();
  });
});

describe("user tasks: provision templates gate", () => {
  it("shows the button when the source user is scoped to the domain", () => {
    renderWith([{ verb: ["POST"], endpoint: "/users/%@{domain}/templates?action=provision&from=%@{domain}" }]);
    expect(screen.queryByText("users.tasks.provisionTemplates")).not.toBeNull();
  });

  it("hides it without a rule covering the provisioning call", () => {
    renderWith([{ verb: ["POST"], endpoint: "/users/%@{domain}/templates?action=other" }]);
    expect(screen.queryByText("users.tasks.provisionTemplates")).toBeNull();
  });
});

describe("user tasks: confirmation dialogs preview their command", () => {
  const openDialog = async (label: string) => {
    renderWithResolver({ isAllowed: () => true });
    const row = screen.getByText(label).closest("[data-task-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button"));
    await waitFor(() => expect(dialog.message).not.toBeNull());
    cleanup();
    render(<>{dialog.message as ReactNode}</>);
  };

  afterEach(() => { dialog.message = null; });

  it.each([
    ["users.tasks.subscribeAll", "curl -XPOST /users/bob@linagora.com/mailboxes?task=subscribeAll"],
    ["users.tasks.deleteAllMailboxes", "curl -XDELETE /users/bob@linagora.com/mailboxes"],
    ["users.tasks.deleteData", "curl -XPOST /users/bob@linagora.com?action=deleteData"],
    ["users.tasks.renameUser", "curl -XPOST /users/bob@linagora.com/rename/{newUser}?action=rename"],
    ["users.tasks.restoreDeleted", `curl -XPOST /deletedMessages/users/bob@linagora.com?action=restore -d '{"combinator":"and","criteria":[]}'`],
  ])("%s", async (label, command) => {
    await openDialog(label);
    expect(screen.getByText(command, { exact: false })).not.toBeNull();
  });

  it("follows the values typed in the form", async () => {
    await openDialog("users.tasks.renameUser");
    fireEvent.change(screen.getByLabelText("renameUserForm.newUsername"), { target: { value: "alice@linagora.com" } });
    expect(screen.getByText("curl -XPOST /users/bob@linagora.com/rename/alice@linagora.com?action=rename", { exact: false })).not.toBeNull();
  });

  it("refuses, in DOMAIN mode, to rename into another domain", async () => {
    await openDialog("users.tasks.renameUser");
    expect(dialog.options!.validate!()).toBe("renameUserForm.newUsernameRequired");

    fireEvent.change(screen.getByLabelText("renameUserForm.newUsername"), { target: { value: "victim@other.com" } });
    expect(dialog.options!.validate!()).toBe("renameUserForm.newUsernameOtherDomain");

    fireEvent.change(screen.getByLabelText("renameUserForm.newUsername"), { target: { value: "alice@LINAGORA.com" } });
    expect(dialog.options!.validate!()).toBeNull();
  });

  it("refuses to provision templates from another domain", async () => {
    await openDialog("users.tasks.provisionTemplates");
    expect(dialog.options!.validate!()).toBe("provisionTemplates.sourceUserRequired");

    fireEvent.change(screen.getByLabelText("provisionTemplates.sourceUser"), { target: { value: "victim@other.com" } });
    expect(dialog.options!.validate!()).toBe("provisionTemplates.sourceUserOtherDomain");
    expect(screen.getByLabelText("provisionTemplates.sourceUser").getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(screen.getByLabelText("provisionTemplates.sourceUser"), { target: { value: "ref@LINAGORA.com" } });
    expect(dialog.options!.validate!()).toBeNull();
  });

  it.each([
    ["Templates.Marketing", null],
    ["  Templates  ", null],
    ["INBOX", "provisionTemplates.folderNotTemplates"],
  ])("checks the provisioned folder %j", async (folderName, expected) => {
    await openDialog("users.tasks.provisionTemplates");
    fireEvent.change(screen.getByLabelText("provisionTemplates.sourceUser"), { target: { value: "ref@linagora.com" } });
    fireEvent.change(screen.getByLabelText("provisionTemplates.folderName"), { target: { value: folderName } });

    expect(dialog.options!.validate!()).toBe(expected);
  });

  it("previews the trimmed folder name it sends", async () => {
    await openDialog("users.tasks.provisionTemplates");
    fireEvent.change(screen.getByLabelText("provisionTemplates.sourceUser"), { target: { value: "ref@linagora.com" } });
    fireEvent.change(screen.getByLabelText("provisionTemplates.folderName"), { target: { value: " Templates.Marketing " } });

    expect(screen.getByText("curl -XPOST /users/bob@linagora.com/templates?action=provision&from=ref@linagora.com&folderName=Templates.Marketing", { exact: false })).not.toBeNull();
  });

  it("names the field WebAdmin refused with a 400", async () => {
    await openDialog("users.tasks.provisionTemplates");
    const refusal = new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400, statusText: "", headers: {}, config: { headers: {} as never },
      data: { statusCode: 400, type: "InvalidArgument", message: "Invalid 'folderName' value 'INBOX'. Expected 'Templates' or one of its sub-folders.", details: null },
    });
    cleanup();
    render(<>{dialog.options!.describeError!(refusal)}</>);

    expect(screen.getByText("provisionTemplates.refused.folder")).not.toBeNull();
    expect(screen.getByText("Invalid 'folderName' value 'INBOX'. Expected 'Templates' or one of its sub-folders.")).not.toBeNull();
  });

  it("refuses to restore deleted messages while a criterion is incomplete, and flags it", async () => {
    await openDialog("users.tasks.restoreDeleted");
    expect(dialog.options!.validate!()).toBeNull();

    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));
    const field = screen.getByRole("combobox", { name: "users.deletedVault.criteria.fieldPlaceholder" });
    const operator = screen.getByRole("combobox", { name: "users.deletedVault.criteria.operatorPlaceholder" });
    // Only the builder's hint before a confirm
    expect(screen.getByText("users.deletedVault.criteria.incomplete").getAttribute("role")).toBe("status");
    expect(screen.queryAllByRole("alert")).toEqual([]);
    expect(field.getAttribute("aria-invalid")).toBe("false");

    let error: string | null = null;
    act(() => { error = dialog.options!.validate!(); });
    expect(error).toBe("users.deletedVault.criteria.incomplete");
    // The dialog shows the returned error as an alert: the hint gives way to it
    expect(screen.queryByText("users.deletedVault.criteria.incomplete")).toBeNull();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(operator.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByPlaceholderText("users.deletedVault.criteria.valuePlaceholder").getAttribute("aria-invalid")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" }));
    expect(dialog.options!.validate!()).toBeNull();
  });

  it("marks the tier retention period required, not optional, and refuses it empty", async () => {
    await openDialog("users.tasks.tierData");
    const field = screen.getByLabelText("tiering *");
    expect(field.getAttribute("aria-required")).toBe("true");
    expect(screen.queryByLabelText("tiering (common.optional)")).toBeNull();
    // Only messagesPerSecond keeps a clear button and an "(optional)" mark
    expect(screen.getByLabelText("messagesPerSecond (common.optional)")).not.toBeNull();
    expect(screen.queryAllByRole("button", { name: "commonTasks.clearParam" })).toEqual([]);
    expect(dialog.options!.validate!()).toBeNull();

    fireEvent.change(field, { target: { value: "" } });
    expect(dialog.options!.validate!()).toBe("users.tasks.tieringRequired");
  });

  it.each(["0", "00", "-1"])("refuses a tier retention period of %s: 0 would evict the whole account", async (amount) => {
    await openDialog("users.tasks.tierData");
    fireEvent.change(screen.getByLabelText("tiering *"), { target: { value: amount } });
    expect(dialog.options!.validate!()).toBe("users.tasks.tieringPositive");
  });

  it("accepts a strictly positive tier retention period", async () => {
    await openDialog("users.tasks.tierData");
    fireEvent.change(screen.getByLabelText("tiering *"), { target: { value: "1" } });
    expect(dialog.options!.validate!()).toBeNull();
  });

  it("tells a 404 of the tiering apart: the user does not exist, with the server message", async () => {
    await openDialog("users.tasks.tierData");
    const notFound = { response: { status: 404, data: { message: "User 'bob@linagora.com' does not exist" } } };
    render(<>{dialog.options!.describeError!(notFound) as ReactNode}</>);
    expect(screen.getByText("users.tasks.tierDataUnknownUser")).not.toBeNull();
    expect(screen.getByText("common.serverMessage")).not.toBeNull();
  });

  it("shows other tiering errors, such as a 400, as the server returned them", async () => {
    await openDialog("users.tasks.tierData");
    expect(dialog.options!.describeError!({ response: { status: 400, data: { message: "Invalid tiering" } } })).toBeNull();
  });
});

describe("user tasks: reindexing an unknown user", () => {
  const openReindexDialog = async () => {
    renderWithResolver({ isAllowed: () => true });
    const row = screen.getByText("users.tasks.reindexAll").closest("[data-task-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button"));
    await waitFor(() => expect(dialog.message).not.toBeNull());
    cleanup();
    render(<>{dialog.message as ReactNode}</>);
  };
  const notFound = Object.assign(new AxiosError("Request failed with status code 404"), {
    response: { status: 404, data: { message: "User 'bob@linagora.com' does not exist" } },
  });

  afterEach(() => {
    dialog.message = null;
    api.reindexUserMailboxes.mockReset();
  });

  it("does not force by default, neither in the request nor in the preview", async () => {
    await openReindexDialog();
    api.reindexUserMailboxes.mockRejectedValue(notFound);

    await expect(dialog.options!.action!()).rejects.toBe(notFound);
    expect(api.reindexUserMailboxes.mock.calls[0][1].force).toBeFalsy();
    expect(screen.getByText(/curl -XPOST/).textContent).toBe("curl -XPOST /users/bob@linagora.com/mailboxes?task=reIndex&messagesPerSecond=50");
  });

  it("sends and previews a bare force once ticked", async () => {
    await openReindexDialog();
    api.reindexUserMailboxes.mockRejectedValue(notFound);
    fireEvent.click(screen.getByLabelText("force (common.optional)"));

    expect(screen.getByText(/curl -XPOST/).textContent).toBe("curl -XPOST /users/bob@linagora.com/mailboxes?task=reIndex&messagesPerSecond=50&force");
    await expect(dialog.options!.action!()).rejects.toBe(notFound);
    expect(api.reindexUserMailboxes).toHaveBeenCalledWith("bob@linagora.com", expect.objectContaining({ force: true }));
  });

  it("says that the user does not exist on a 404, above the server message", async () => {
    await openReindexDialog();
    cleanup();
    render(<>{dialog.options!.describeError!(notFound)}</>);

    expect(screen.getByText("users.tasks.reindexUnknownUser")).not.toBeNull();
    expect(screen.getByText("common.serverMessage")).not.toBeNull();
    expect(screen.getByText("User 'bob@linagora.com' does not exist")).not.toBeNull();
  });

  it("shows any other error as the server returned it", async () => {
    await openReindexDialog();
    expect(dialog.options!.describeError!({ response: { status: 500 } })).toBeNull();
  });

});

describe("user tasks: Run tooltips show the command run with the default parameters", () => {
  it.each([
    ["users.tasks.reindexAll", "curl -XPOST /users/bob@linagora.com/mailboxes?task=reIndex&messagesPerSecond=50"],
    ["users.tasks.fastView", "curl -XPOST /users/bob@linagora.com/mailboxes?task=recomputeFastViewProjectionItems&messagesPerSecond=10"],
    ["users.tasks.tierData", "curl -XPOST /users/bob@linagora.com/data?tiering=30d&messagesPerSecond=50"],
    ["users.tasks.renameUser", "curl -XPOST /users/bob@linagora.com/rename/{newUser}?action=rename"],
    ["users.tasks.restoreDeleted", `curl -XPOST /deletedMessages/users/bob@linagora.com?action=restore -d '{"combinator":"and","criteria":[]}'`],
  ])("%s", async (label, command) => {
    renderWithResolver({ isAllowed: () => true });
    const row = screen.getByText(label).closest("[data-task-row]") as HTMLElement;
    fireEvent.focus(within(row).getByRole("button"));

    expect((await screen.findByRole("tooltip")).textContent).toBe(command);
  });
});
