// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";

const toast = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { useTaskCreatedToast } from "./use-task-created-toast";

afterEach(() => {
  cleanup();
  toast.mockReset();
});

describe("useTaskCreatedToast", () => {
  it("announces a created task, without claiming it ran, with a link to the task page", () => {
    const { result } = renderHook(() => useTaskCreatedToast());

    result.current("1d702597");

    const { title, description } = toast.mock.calls[0][0];
    expect(title).toBe("common.taskCreated");
    render(<MemoryRouter>{description as ReactElement}</MemoryRouter>);
    expect(screen.getByRole("link", { name: 'common.taskLink {"taskId":"1d702597"}' }).getAttribute("href")).toBe("/task/1d702597");
  });

  it("lets the caller name what was scheduled", () => {
    const { result } = renderHook(() => useTaskCreatedToast());

    result.current("1d702597", "Upgrade scheduled");

    expect(toast.mock.calls[0][0].title).toBe("Upgrade scheduled");
  });
});
