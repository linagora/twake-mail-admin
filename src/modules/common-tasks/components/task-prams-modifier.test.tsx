// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TaskParamsModifier from "./task-prams-modifier";
import { TaskParam } from "../types";
import { PARAM_DESCRIPTIONS } from "../param-descriptions";
import en from "@/i18n/locales/en.json";

afterEach(cleanup);

const PARAMS: TaskParam[] = [
  { key: "messagesPerSecond", type: "input", defaultValue: "50" },
  { key: "dryRun", type: "checkbox", defaultValue: false },
  { key: "mode", type: "select", values: ["", "fixOutdated", "rebuildAll"] },
  { key: "olderThan", type: "duration", defaultValue: "30d" },
];

describe("task parameters: field labels", () => {
  it.each([
    ["messagesPerSecond", "INPUT"],
    ["dryRun", "BUTTON"],
    ["mode", "BUTTON"],
    ["olderThan", "INPUT"],
  ])("names the %s field after its visible label, marked optional", (key, tagName) => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    expect(screen.getByLabelText(`${key} (common.optional)`).tagName).toBe(tagName);
  });

  it("marks a required parameter required, not optional", () => {
    render(<TaskParamsModifier params={[{ key: "queue", type: "input", optional: false }]} handleChangeParam={() => {}} />);

    const field = screen.getByLabelText("queue *");
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("aria-required")).toBe("true");
    expect(screen.queryByText("(common.optional)", { exact: false })).toBeNull();
  });

  it("offers neither clearing nor \"no limit\" on a required duration", () => {
    render(<TaskParamsModifier params={[{ key: "tiering", type: "duration", defaultValue: "30d", optional: false }]} handleChangeParam={() => {}} />);

    const field = screen.getByLabelText("tiering *");
    expect(field.getAttribute("aria-required")).toBe("true");
    expect(field.getAttribute("placeholder")).toBeNull();
    expect(screen.queryAllByRole("button", { name: "commonTasks.clearParam" })).toEqual([]);
  });

  it("links each field to its help text", () => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    const field = screen.getByLabelText("messagesPerSecond (common.optional)");
    const help = document.getElementById(field.getAttribute("aria-describedby")!);
    expect(help?.textContent).toBe("commonTasks.params.messagesPerSecond.help");
  });

  it("offers the default value as placeholder", () => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    expect(screen.getByLabelText("messagesPerSecond (common.optional)").getAttribute("placeholder")).toBe("commonTasks.params.defaultPlaceholder");
  });

  it("tells what an empty processor does rather than its prefilled value", () => {
    render(<TaskParamsModifier params={[{ key: "processor", type: "input", defaultValue: "root" }]} handleChangeParam={() => {}} />);

    expect(screen.getByLabelText("processor (common.optional)").getAttribute("placeholder")).toBe("commonTasks.params.processor.placeholder");
  });

  it("names the duration unit select", () => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    expect(screen.getByRole("combobox", { name: "commonTasks.durationUnit" })).toBeTruthy();
  });

  it("names the clear button of the duration field", () => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    expect(screen.getAllByRole("button", { name: "commonTasks.clearParam" })).toHaveLength(1);
  });

  it("shows the empty option of a select as a real option", () => {
    render(<TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />);

    expect(screen.getByLabelText("mode (common.optional)").textContent).toBe("commonTasks.params.empty.serverDefault");
  });

  it("keeps advanced parameters in a closed section", () => {
    render(<TaskParamsModifier params={[...PARAMS, { key: "fromStep", type: "input", advanced: true }]} handleChangeParam={() => {}} />);

    const details = screen.getByText("common.advancedOptions").closest("details")!;
    expect(details.open).toBe(false);
    expect(details.contains(screen.getByLabelText("fromStep (common.optional)"))).toBe(true);
  });

  it("gives each dialog its own ids so that two parameter lists on a page do not collide", () => {
    render(
      <>
        <TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />
        <TaskParamsModifier params={PARAMS} handleChangeParam={() => {}} />
      </>
    );

    const fields = screen.getAllByLabelText("messagesPerSecond (common.optional)");
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });
});

describe("task parameters: descriptions", () => {
  type Tree = { [key: string]: string | Tree };
  const params = ((en.commonTasks as Tree).params as Tree);
  const entry = (key: string) => params[key] as Tree | undefined;

  it.each(Object.entries(PARAM_DESCRIPTIONS))("%s has the English texts it declares", (key, description) => {
    expect(entry(key)?.label).toBeTypeOf("string");
    if (description.help) expect(entry(key)?.help).toBeTypeOf("string");
    if (description.unit) expect(entry(key)?.unit).toBeTypeOf("string");
    if (description.values) expect(entry(key)?.values).toBeTypeOf("object");
  });

  // Guards against a new task parameter shown under its raw query key
  it("describes every parameter declared by a task dialog", () => {
    const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { eager: true, query: "?raw", import: "default" });
    const declared = new Set<string>();
    for (const [path, source] of Object.entries(sources)) {
      if (path.includes(".test.")) continue;
      for (const match of source.matchAll(/\{\s*key:\s*["']([A-Za-z]+)["'][^}]*type:\s*["'](?:input|checkbox|select|duration)["']/g)) {
        declared.add(match[1]);
      }
    }
    expect(declared.size).toBeGreaterThan(20);
    expect([...declared].filter((key) => !(key in PARAM_DESCRIPTIONS))).toEqual([]);
  });
});
