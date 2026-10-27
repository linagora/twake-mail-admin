// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TaskDetailResponse } from "@/modules/common-tasks/types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-managed-domains", () => ({ useManagedDomains: () => new Set(["example.com", "open-paas.org"]) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/modules/domains/api-client", () => ({
  getTeamCalendars: async () => [{ id: "6adc", name: "ux-audit-2", displayName: "UX Audit Support Team" }],
  getResource: async () => ({ id: "r1", name: "ux-audit-1 Room" }),
}));

import { TaskDetails, TaskSummary } from "./task-summary";

const renderDetails = (additionalInformation: Record<string, unknown>) => {
  const task = { taskId: "t1", type: "x", status: "completed", additionalInformation } as unknown as TaskDetailResponse;
  const { container } = render(<MemoryRouter><TaskDetails task={task} raw={task} /></MemoryRouter>);
  return container.querySelector(".grid")!;
};

afterEach(cleanup);

describe("task details", () => {
  it("labels the counters of the tasks the console starts, without repeating the type", () => {
    const grid = renderDetails({
      type: "recompute-current-quotas",
      processedQuotaRoots: 66,
      failedQuotaRoots: [],
      runningOptions: { usersPerSecond: 1, quotaComponents: [] },
      recomputeSingleQuotaComponentResults: [{ quotaComponent: "MAILBOX" }],
    });
    expect(grid.textContent).toContain("tasks.info.processedUserCount66");
    expect(grid.textContent).toContain("tasks.info.failedUsers—");
    expect(grid.textContent).not.toContain("recompute-current-quotas");
    expect(grid.textContent).not.toContain("runningOptions");
    expect(grid.textContent).not.toContain("recomputeSingleQuotaComponentResults");
  });

  it("labels the counters of a Twake Space purge and links the team mailboxes it could not delete", () => {
    const grid = renderDetails({
      type: "twake-space-purge",
      timestamp: "2026-10-09T08:00:00Z",
      deletedTeamMailboxes: 2,
      failedTeamMailboxes: ["sales@acme.com", "ops@acme.com"],
    });
    expect(grid.textContent).toContain("tasks.info.deletedTeamMailboxes2");
    expect(grid.textContent).toContain("tasks.info.failedTeamMailboxes");
    expect(grid.textContent).toContain("tasks.info.failedTeamMailboxesRetried");
    expect(screen.getByRole("link", { name: "sales@acme.com" }).getAttribute("href")).toBe("/domains/domain/acme.com/team-mailbox/sales");
    expect(screen.getByRole("link", { name: "ops@acme.com" }).getAttribute("href")).toBe("/domains/domain/acme.com/team-mailbox/ops");
  });

  it("shows a dash, without the retry hint, when the purge deleted every team mailbox", () => {
    const grid = renderDetails({ type: "twake-space-purge", deletedTeamMailboxes: 2, failedTeamMailboxes: [] });
    expect(grid.textContent).toContain("tasks.info.failedTeamMailboxes—");
    expect(grid.textContent).not.toContain("tasks.info.failedTeamMailboxesRetried");
  });

  it("labels the counter of a Twake Space reindex", () => {
    const grid = renderDetails({ type: "twake-space-reindex", timestamp: "2026-10-09T08:00:00Z", indexedSpaces: 12 });
    expect(grid.textContent).toContain("tasks.info.indexedSpaces12");
  });

  it("labels the mailbox counters of a populate email query view", () => {
    const grid = renderDetails({
      type: "PopulateEmailQueryViewTask",
      processedMailboxCount: 12,
      failedMailboxCount: 1,
      processedMessageCount: 340,
      failedMessageCount: 2,
      runningOptions: { messagesPerSecond: 50 },
    });
    expect(grid.textContent).toContain("tasks.info.processedMailboxes12");
    expect(grid.textContent).toContain("tasks.info.failedMailboxes1");
    expect(grid.textContent).toContain("tasks.info.processedMessageCount340");
    expect(grid.textContent).toContain("tasks.info.failedMessageCount2");
    expect(grid.textContent).not.toContain("MailboxCount");
  });

  it("labels the user counters of a populate email query view from an older backend", () => {
    const grid = renderDetails({
      type: "PopulateEmailQueryViewTask",
      processedUserCount: 3,
      failedUserCount: 0,
      processedMessageCount: 340,
      failedMessageCount: 0,
      runningOptions: { messagesPerSecond: 50 },
    });
    expect(grid.textContent).toContain("tasks.info.processedUserCount3");
    expect(grid.textContent).toContain("tasks.info.failedUsers0");
    expect(grid.textContent).not.toContain("failedUserCount");
  });

  it("shows the user, folder and age of a Trash cleanup before its counters", () => {
    const task = {
      taskId: "t1", type: "ExpireMailboxTask", status: "completed",
      additionalInformation: {
        type: "ExpireMailboxTask", mailboxesExpired: 0, mailboxesFailed: 0, mailboxesProcessed: 0, messagesDeleted: 0,
        runningOptions: { usersPerSecond: 1, mailbox: "Trash", useSavedDate: true, user: "bob@example.com", byExpiresHeader: false, olderThan: "5d" },
      },
    } as unknown as TaskDetailResponse;
    const { container } = render(<MemoryRouter><TaskDetails task={task} raw={task} /></MemoryRouter>);
    const text = container.querySelector(".grid")!.textContent;
    expect(text).toMatch(/^tasks\.info\.usernamebob@example\.comtasks\.info\.folderTrashtasks\.info\.olderThan5d/);
    expect(text).toContain("tasks.info.messagesDeleted0");
    expect(screen.getByRole("link", { name: "bob@example.com" }).getAttribute("href")).toBe("/users/user/bob%40example.com");
  });

  it("labels the old and new usernames of a user rename", () => {
    const grid = renderDetails({
      type: "UsernameChangeTask",
      oldUser: "qa-ren1@example.com",
      newUser: "qa-ren2@example.com",
      status: { A: "DONE" },
      fromStep: null,
    });
    expect(grid.textContent).toContain("tasks.info.oldUserqa-ren1@example.com");
    expect(grid.textContent).toContain("tasks.info.newUserqa-ren2@example.com");
  });

  it("labels the failed mailboxes of a reindexing", () => {
    const grid = renderDetails({
      type: "user-reindexing",
      username: "bob@example.com",
      successfullyReprocessedMailCount: 2,
      failedReprocessedMailCount: 0,
      messageFailures: {},
      mailboxFailures: [],
    });
    expect(grid.textContent).toContain("tasks.info.failedMailboxes—");
    expect(grid.textContent).not.toContain("mailboxFailures");
  });

  it("leaves the nested values to the raw JSON", () => {
    renderDetails({ runningOptions: { user: null } });
    expect(screen.getByText("tasks.rawJson")).not.toBeNull();
    expect(document.querySelector("details pre")!.textContent).toContain("runningOptions");
  });
});

describe("task summary: what a calendar task worked on", () => {
  const summary = (additionalInformation: Record<string, unknown>) => {
    const task = { taskId: "t1", type: "domain-calendar-import", status: "completed", additionalInformation } as unknown as TaskDetailResponse;
    render(<MemoryRouter><TaskSummary task={task} /></MemoryRouter>);
  };

  it("names the team calendar and links its domain", async () => {
    summary({ domain: "open-paas.org", calendarType: "team-calendar", calendarId: "6adc" });
    expect(await screen.findByText(/UX Audit Support Team/)).not.toBeNull();
    expect(screen.getByRole("link", { name: "open-paas.org" }).getAttribute("href")).toBe("/domains/domain/open-paas.org");
  });

  it("links a resource to its page", async () => {
    summary({ domain: "open-paas.org", calendarType: "resource", calendarId: "r1" });
    expect(screen.getByRole("link", { name: "tasks.targetCalendar.resource" }).getAttribute("href")).toBe("/domains/domain/open-paas.org/resource/r1");
    expect(await screen.findByText(/ux-audit-1 Room/)).not.toBeNull();
  });

  it("links the user of an archival in the details", () => {
    renderDetails({ targetUser: "alice@open-paas.org", archivedEventCount: 0 });
    expect(screen.getByRole("link", { name: "alice@open-paas.org" }).getAttribute("href")).toBe("/users/user/alice%40open-paas.org");
  });
});
