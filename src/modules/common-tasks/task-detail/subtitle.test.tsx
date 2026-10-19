// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { TaskStatus } from "../types";

const TASK_ID = vi.hoisted(() => "4ebc9187-1542-4277-8cdb-9ca7576948a2");
const api = vi.hoisted(() => ({ getTaskDetail: vi.fn(), cancelTask: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => null }));
vi.mock("@/components/custom/header", () => ({
  default: ({ headerSubTitle }: { headerSubTitle: ReactNode }) => <h1>{headerSubTitle}</h1>,
}));
vi.mock("../api-client", () => api);

import i18n from "@/i18n";
import TaskDetail from "./index";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

describe("task detail: subtitle", () => {
  it("is translated, with the task id underlined", async () => {
    await i18n.changeLanguage("fr");
    api.getTaskDetail.mockResolvedValue({ taskId: TASK_ID, status: TaskStatus.COMPLETED });
    render(
      <MemoryRouter initialEntries={[`/task/${TASK_ID}`]}>
        <Routes>
          <Route path="/task/:id" element={<TaskDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const subtitle = await screen.findByRole("heading", { level: 1 });
    expect(subtitle.textContent).toBe(`Tâche ${TASK_ID}`);
    expect(subtitle.querySelector("u")?.textContent).toBe(TASK_ID);
  });
});
