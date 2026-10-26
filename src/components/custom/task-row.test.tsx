// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TaskRow from "./task-row";

afterEach(cleanup);

describe("task row", () => {
  it("runs the task from a green button without badge when safe", () => {
    const onRun = vi.fn();
    render(<TaskRow title="Reindex" onRun={onRun} />);
    const button = screen.getByRole("button", { name: "common.run Reindex" });
    expect(button.className).toContain("bg-green-700");
    expect(screen.queryByText("tasks.risk.caution")).toBeNull();
    fireEvent.click(button);
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("states in words that a caution task modifies data", () => {
    render(<TaskRow title="Rename user" risk="caution" onRun={() => {}} />);
    expect(screen.getByText("tasks.risk.caution")).not.toBeNull();
    expect(screen.getByRole("button", { name: "common.run Rename user" }).className).toContain("bg-orange-700");
  });

  it("states in words that a destructive task deletes data, on a red button", () => {
    render(<TaskRow title="Delete user data" risk="destructive" onRun={() => {}} />);
    expect(screen.getByText("tasks.risk.destructive")).not.toBeNull();
    expect(screen.getByRole("button", { name: "common.run Delete user data" }).className).toContain("bg-red-600");
  });

  it("uses none of the low-contrast colours", () => {
    for (const risk of ["safe", "caution", "destructive"] as const) {
      const { unmount } = render(<TaskRow title="Task" risk={risk} onRun={() => {}} />);
      expect(screen.getByRole("button").className).not.toMatch(/bg-(green-400|yellow-500|orange-500)/);
      unmount();
    }
  });

  it("names each Run button after its task, not after its doc link", () => {
    render(
      <>
        <TaskRow title="Reindex" doc="https://example.com" onRun={() => {}} />
        <TaskRow title="Rename user" onRun={() => {}} />
      </>
    );
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["common.run", "common.run"]);
    expect(screen.getByRole("button", { name: "common.run Reindex" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "common.run Rename user" })).not.toBeNull();
  });

  it("describes the Run button by its risk and its command", () => {
    render(<TaskRow title="Delete user data" risk="destructive" command="DELETE /users/bob" onRun={() => {}} />);
    expect(screen.getByRole("button", { name: "common.run Delete user data", description: "tasks.risk.destructive DELETE /users/bob" })).not.toBeNull();
  });

  it("gives a safe task without command no description", () => {
    render(<TaskRow title="Reindex" onRun={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-describedby")).toBeNull();
  });
});
