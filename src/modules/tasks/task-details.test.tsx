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
