// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TaskDetailResponse } from "@/modules/common-tasks/types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-managed-domains", () => ({ useManagedDomains: () => new Set(["example.com"]) }));

import { TaskDetails } from "./task-summary";

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

  it("leaves the nested values to the raw JSON", () => {
    renderDetails({ runningOptions: { user: null } });
    expect(screen.getByText("tasks.rawJson")).not.toBeNull();
    expect(document.querySelector("details pre")!.textContent).toContain("runningOptions");
  });
});
