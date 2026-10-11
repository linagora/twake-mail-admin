// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const TASK_ID = vi.hoisted(() => "4ebc9187-1542-4277-8cdb-9ca7576948a2");
const api = vi.hoisted(() => ({ getTaskDetail: vi.fn(), cancelTask: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => null }));
vi.mock("@/components/custom/header", () => ({ default: () => null }));
vi.mock("../api-client", () => api);

import TaskDetail from "./index";

function renderTaskDetail() {
  render(
    <MemoryRouter initialEntries={[`/task/${TASK_ID}`]}>
      <Routes>
        <Route path="/task/:id" element={<TaskDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  api.getTaskDetail.mockReset();
});

describe("task detail", () => {
  it("displays the task exactly as returned by WebAdmin", async () => {
    const taskDetail = {
      taskId: TASK_ID,
      type: "full-reindexing",
      status: "inProgress",
      submitDate: "2026-10-11T18:39:32.907+0000",
      startedDate: "2026-10-11T18:39:32.921+0000",
      completedDate: null,
      additionalInformation: { timestamp: "2026-10-11T18:39:32.907318528Z" },
    };
    api.getTaskDetail.mockResolvedValue(taskDetail);
    renderTaskDetail();

    const json = await screen.findByText((_, element) => element?.tagName === "PRE");

    expect(JSON.parse(json.textContent ?? "")).toEqual(taskDetail);
  });
});
