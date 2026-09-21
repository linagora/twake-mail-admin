// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({ deleteAll: vi.fn(async () => ({ taskId: "task-1" })) }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("./api-client", () => ({
  getUnsentMailIds: async () => [],
  getUnsentMail: async () => ({}),
  deleteAllUnsentMails: api.deleteAll,
  deleteUnsentMail: async () => {},
  resendAllUnsentMails: async () => ({ taskId: "task-0" }),
  resendUnsentMail: async () => ({ taskId: "task-0" }),
  downloadUnsentMail: async () => {},
}));

import UnsentMailsList from "./unsent-mails-list";

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
  render(
    <MemoryRouter>
      <UnsentMailsList />
    </MemoryRouter>
  );
}

const button = (name: RegExp) => screen.queryByRole("button", { name });
const deleteAllButton = () => button(/^unsentMails\.deleteAll(Filtered)?$/);
const resendAllButton = () => button(/^unsentMails\.resendAll$/);

const fillFilter = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

afterEach(() => {
  api.deleteAll.mockClear();
  cleanup();
});

describe("unsent mails: delete all gates", () => {
  it("shows the button with a query-less rule, which the proxy applies to every query", () => {
    renderWith([{ verb: ["POST"], endpoint: "/unsentMails" }]);
    expect(deleteAllButton()).not.toBeNull();
  });

  it("hides it when only the resend task is granted: that rule pins another action", () => {
    renderWith([{ verb: ["POST"], endpoint: "/unsentMails?action=resend" }]);
    expect(deleteAllButton()).toBeNull();
  });

  it("shows it, and not resend all, when only the delete task is granted", () => {
    renderWith([{ verb: ["POST"], endpoint: "/unsentMails?action=delete" }]);
    expect(deleteAllButton()).not.toBeNull();
    expect(resendAllButton()).toBeNull();
  });
});

describe("unsent mails: delete all selection", () => {
  it("deletes everything when no filter is set", async () => {
    renderWith([{ verb: ["POST"], endpoint: "/unsentMails" }]);
    fireEvent.click(deleteAllButton()!);
    await waitFor(() =>
      expect(api.deleteAll).toHaveBeenCalledWith({ sender: undefined, recipient: undefined })
    );
  });

  it("forwards the filters of the page to the task", async () => {
    renderWith([{ verb: ["POST"], endpoint: "/unsentMails" }]);
    fillFilter("unsentMails.searchSender", "btellier@linagora.com");
    fireEvent.click(deleteAllButton()!);
    await waitFor(() =>
      expect(api.deleteAll).toHaveBeenCalledWith({
        sender: "btellier@linagora.com",
        recipient: undefined,
      })
    );
  });

  it("refuses a partial filter, which selects rows here but is rejected by the task", () => {
    renderWith([{ verb: ["POST"], endpoint: "/unsentMails" }]);
    fillFilter("unsentMails.searchRecipient", "btellier");
    fireEvent.click(deleteAllButton()!);
    expect(api.deleteAll).not.toHaveBeenCalled();
    expect(screen.queryByText("unsentMails.deleteAllFilterNotAnAddress")).not.toBeNull();
  });
});
