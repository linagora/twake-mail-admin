// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TaskParamsModifier from "./task-prams-modifier";
import { TaskParam } from "../types";

afterEach(cleanup);

const PARAMS: TaskParam[] = [
  { key: "messagesPerSecond", type: "input", defaultValue: "50" },
  { key: "dryRun", type: "checkbox", defaultValue: false },
  { key: "mode", type: "select", values: ["rebuildAll", "fixOutdated"] },
  { key: "olderThan", type: "duration", defaultValue: "30d" },
];

describe("task parameters: field labels", () => {
  it.each([
    ["messagesPerSecond", "INPUT"],
    ["dryRun", "BUTTON"],
    ["mode", "BUTTON"],
    ["olderThan", "INPUT"],
  ])("names the %s field after its visible label", (key, tagName) => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    expect(screen.getByLabelText(`${key}:`).tagName).toBe(tagName);
  });

  it("gives each dialog its own ids so that two parameter lists on a page do not collide", () => {
    render(
      <>
        <TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />
        <TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />
      </>
    );

    const fields = screen.getAllByLabelText("messagesPerSecond:");
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });
});
