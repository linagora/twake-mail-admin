// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const DOMAIN = "acme.com";
const RESTORE_ID = "11111111-0000-4000-8000-000000000001";
const RECOMPUTE_ID = "22222222-0000-4000-8000-000000000002";

// A fake WebAdmin: the domain-scoped task routes, answering one of each team mailbox task
const webAdmin = vi.hoisted(() => {
  const restore = {
    taskId: "11111111-0000-4000-8000-000000000001",
    type: "team-mailbox-deleted-messages-restore",
    status: "completed",
    submitDate: "2026-11-21T10:00:00Z",
    startedDate: "2026-11-21T10:00:01Z",
    completedDate: "2026-11-21T10:00:02Z",
    additionalInformation: { type: "team-mailbox-deleted-messages-restore", teamMailboxAddress: "sales@acme.com", successfulRestoreCount: 12, errorRestoreCount: 0 },
  };
  const recompute = {
    taskId: "22222222-0000-4000-8000-000000000002",
    type: "recompute-quota-team-mailboxes",
    status: "inProgress",
    submitDate: "2026-11-21T09:00:00Z",
    startedDate: "2026-11-21T09:00:01Z",
    additionalInformation: { type: "recompute-quota-team-mailboxes", domain: "acme.com", processedQuotaRoots: 1, failedQuotaRoots: [] },
  };
  const tasks = [restore, recompute];
  const routes: Record<string, unknown> = {
    "/domains/acme.com/tasks": tasks,
    ...Object.fromEntries(tasks.map((task) => [`/domains/acme.com/tasks/${task.taskId}`, task])),
  };
  const get = vi.fn(async (url: string) => {
    if (url in routes) return routes[url];
    throw Object.assign(new Error(`404 ${url}`), { response: { status: 404 } });
  });
  return { get, delete: vi.fn() };
});

vi.mock("@/lib/apiClient", () => ({ apiClient: webAdmin }));
vi.mock("@/lib/config", () => ({ appConfig: { mode: "DOMAIN", application: "MAIL" } }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-managed-domains", () => ({ useManagedDomains: () => new Set(["acme.com"]) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/custom/header", () => ({ default: () => null }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => "acme.com" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import Tasks from "./index";
import TaskDetail from "@/modules/common-tasks/task-detail";

function renderDomainAdmin() {
  render(
    <MemoryRouter initialEntries={["/tasks"]}>
      <Routes>
        <Route path="/tasks" element={<Tasks domain={DOMAIN} />} />
        <Route path="/task/:id" element={<TaskDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  webAdmin.get.mockClear();
});

describe("tasks of a domain", () => {
  it("lists the team mailbox tasks of the domain with readable names, through the domain-scoped route", async () => {
    renderDomainAdmin();

    const rows = await screen.findAllByTestId("task-row");

    expect(webAdmin.get).toHaveBeenCalledWith(`/domains/${DOMAIN}/tasks`);
    expect(webAdmin.get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/tasks/));
    expect(rows.map((row) => within(row).getAllByRole("button")[0].textContent))
      .toEqual(["taskTypes.teamMailboxRestoreDeleted", "taskTypes.recomputeTeamMailboxQuotas"]);
    expect(within(rows[0]).getByRole("link", { name: "sales@acme.com" }).getAttribute("href"))
      .toBe("/domains/domain/acme.com/team-mailbox/sales");
    // A domain administrator has no domain page
    expect(within(rows[1]).getByText(DOMAIN).closest("a")).toBeNull();
  });

  it("offers the types of the domain in the type picker, by name", async () => {
    renderDomainAdmin();
    await screen.findAllByTestId("task-row");

    fireEvent.click(screen.getByRole("button", { name: "tasks.filters" }));

    const options = within(screen.getByLabelText("tasks.type")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["tasks.allTypes", "taskTypes.recomputeTeamMailboxQuotas", "taskTypes.teamMailboxRestoreDeleted"]);
    expect(screen.queryByTestId("tasks-date-filters")).toBeNull();
  });

  it.each([
    [0, RESTORE_ID],
    [1, RECOMPUTE_ID],
  ])("opens the page of task %i through the domain-scoped route", async (index, taskId) => {
    renderDomainAdmin();
    const rows = await screen.findAllByTestId("task-row");

    fireEvent.click(within(rows[index]).getAllByRole("button")[0]);
    fireEvent.click(await screen.findByRole("link", { name: "tasks.fullDetails" }));

    await screen.findByText((_, element) => element?.tagName === "PRE");
    expect(webAdmin.get).toHaveBeenCalledWith(`/domains/${DOMAIN}/tasks/${taskId}`);
    expect(webAdmin.get).not.toHaveBeenCalledWith(`/tasks/${taskId}`);
  });
});
