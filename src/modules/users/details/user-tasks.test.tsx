// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL", mode: "DOMAIN", sso: null } }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("../api-client", () => ({}));

import UserTasks from "./user-tasks";

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
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
