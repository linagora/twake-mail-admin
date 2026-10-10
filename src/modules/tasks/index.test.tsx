// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Hoisted: the vi.mock factories below run before the module's top-level declarations
const TASK_ID = vi.hoisted(() => "30dcd0fb-0000-4000-8000-000000000001");

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/modules/common-tasks/api-client", () => ({ cancelTask: vi.fn() }));
vi.mock("./api-client", () => ({
  listTasks: vi.fn().mockResolvedValue([
    {
      taskId: TASK_ID,
      type: "full-reindexing",
      status: "completed",
      submitDate: "2026-10-10T06:00:00Z",
      startedDate: "2026-10-10T06:00:01Z",
      completedDate: "2026-10-10T06:00:02Z",
    },
  ]),
}));

import Tasks from "./index";

afterEach(cleanup);

describe("tasks list", () => {
  it("exposes each task ID as a keyboard reachable button opening its details", async () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    const taskButton = await screen.findByRole("button", { name: TASK_ID });
    taskButton.focus();
    expect(document.activeElement).toBe(taskButton);

    fireEvent.click(taskButton);

    expect(await screen.findByRole("dialog")).not.toBeNull();
  });
});
