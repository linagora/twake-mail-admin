// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL", mode: "DOMAIN", sso: null } }));
const dialog = vi.hoisted(() => ({ message: null as unknown, validate: undefined as (() => string | null) | undefined }));
vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => async (options: { message: unknown; validate?: () => string | null }) => {
    dialog.message = options.message;
    dialog.validate = options.validate;
    return false;
  },
}));
vi.mock("../api-client", () => ({}));

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

describe("user tasks: confirmation dialogs preview their command", () => {
  const openDialog = async (label: string) => {
    renderWithResolver({ isAllowed: () => true });
    const row = screen.getByText(label).parentElement!;
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
    fireEvent.change(screen.getByLabelText("renameUserForm.newUsername:"), { target: { value: "alice@linagora.com" } });
    expect(screen.getByText("curl -XPOST /users/bob@linagora.com/rename/alice@linagora.com?action=rename", { exact: false })).not.toBeNull();
  });

  it("refuses to restore deleted messages while a criterion is incomplete", async () => {
    await openDialog("users.tasks.restoreDeleted");
    expect(dialog.validate!()).toBeNull();

    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));
    expect(dialog.validate!()).toBe(false);
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual(["users.deletedVault.criteria.incomplete"]);

    fireEvent.click(screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" }));
    expect(dialog.validate!()).toBeNull();
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
    const row = screen.getByText(label).parentElement!;
    fireEvent.focus(within(row).getByRole("button"));

    expect((await screen.findByRole("tooltip")).textContent).toBe(command);
  });
});
