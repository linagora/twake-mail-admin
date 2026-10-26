// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL", mode: "GLOBAL", sso: null } }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("./api-client", () => ({}));

import CommonTasks from "./index";
import { parseCleanupDays } from "./cleanup-days";

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
  render(
    <MemoryRouter>
      <CommonTasks />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("common tasks: platform-wide cleanup gates", () => {
  it("shows both cleanup buttons with /messages", () => {
    renderWith([{ verb: ["DELETE"], endpoint: "/messages" }]);
    expect(screen.queryByText("commonTasks.cleanupTrashAll")).not.toBeNull();
    expect(screen.queryByText("commonTasks.cleanupSpamAll")).not.toBeNull();
  });

  it.each([
    ["commonTasks.cleanupTrashAll", `curl -XDELETE "/messages?olderThan=5d&mailbox=Trash&useSavedDate"`],
    ["commonTasks.cleanupSpamAll", `curl -XDELETE "/messages?olderThan=5d&mailbox=Spam&useSavedDate"`],
  ])("shows in the Run tooltip of %s the command its dialog previews", async (label, command) => {
    renderWith([{ verb: ["DELETE"], endpoint: "/messages" }]);
    const row = screen.getByText(label).closest("[data-task-row]") as HTMLElement;
    fireEvent.focus(within(row).getByRole("button", { name: /^common\.run / }));

    expect((await screen.findByRole("tooltip")).textContent).toBe(command);
  });

  it("hides them with the user-scoped rule, which does not cover a call without user", () => {
    renderWith([{ endpoint: "/messages?user=%@{domain}" }]);
    expect(screen.queryByText("commonTasks.cleanupTrashAll")).toBeNull();
    expect(screen.queryByText("commonTasks.cleanupSpamAll")).toBeNull();
  });
});

describe("parseCleanupDays", () => {
  it.each([["1", 1], ["30", 30], [" 7 ", 7]])("accepts %j", (value, expected) => {
    expect(parseCleanupDays(value)).toBe(expected);
  });

  it.each(["0", "-3", "", "1.5", "3abc", "abc"])("rejects %j", (value) => {
    expect(parseCleanupDays(value)).toBeNull();
  });
});

describe("common tasks: cleaning up old tasks validation", () => {
  const cleanupRow = () => {
    renderWith([{ verb: ["DELETE"], endpoint: "/tasks" }]);
    const input = screen.getByLabelText("commonTasks.days") as HTMLInputElement;
    const row = input.closest("[data-task-row]") as HTMLElement;
    return { input, runButton: within(row).getByRole("button", { name: /^common\.run / }) };
  };

  it("enables Run without validation message for the default value", () => {
    const { runButton } = cleanupRow();
    expect((runButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("commonTasks.invalidCleanupDays")).toBeNull();
  });

  it.each(["0", "-3", ""])("disables Run and shows a validation message for %j", (value) => {
    const { input, runButton } = cleanupRow();
    fireEvent.change(input, { target: { value } });
    expect((runButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("commonTasks.invalidCleanupDays")).not.toBeNull();
  });
});

describe("common tasks: groups and filter", () => {
  const groupHeadings = () => screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent).filter((text) => text?.startsWith("commonTasks.group."));
  const ALL: ProxyRule[] = [{ verb: ["GET", "POST", "PUT", "PATCH", "DELETE"], endpoint: "/**" }];

  it("lists the tasks under the four headings, in order", () => {
    renderWith(ALL);
    expect(groupHeadings()).toEqual([
      "commonTasks.group.search",
      "commonTasks.group.consistency",
      "commonTasks.group.cleanup",
      "commonTasks.group.server",
    ]);
    const cleanupGroup = screen.getByRole("region", { name: "commonTasks.group.cleanup" });
    expect(within(cleanupGroup).queryByText("commonTasks.blobGarbageCollection")).not.toBeNull();
    expect(within(cleanupGroup).queryByText("commonTasks.cleaningUpOldTasks")).not.toBeNull();
  });

  it("describes every task", () => {
    renderWith(ALL);
    expect(screen.queryByText("commonTasks.desc.recomputeMailboxQuota")).not.toBeNull();
    expect(screen.queryByText("commonTasks.desc.reloadCertificates")).not.toBeNull();
  });

  it("keeps only the tasks matching the filter, and says when none does", () => {
    renderWith(ALL);
    const filter = screen.getByLabelText("commonTasks.filter");

    fireEvent.change(filter, { target: { value: "QUOTA" } });
    expect(screen.queryByText("commonTasks.recomputeMailboxQuota")).not.toBeNull();
    expect(screen.queryByText("commonTasks.blobGarbageCollection")).toBeNull();

    fireEvent.change(filter, { target: { value: "zzz" } });
    expect(screen.queryByText("commonTasks.noMatch")).not.toBeNull();
    expect(groupHeadings()).toEqual([]);
  });
});
