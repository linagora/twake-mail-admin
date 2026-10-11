// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ConfirmTaskContent from "./confirm-task-content";
import { TaskParam } from "../types";

const COMMAND = "curl -XPOST /users/bob@example.com/data";

function renderWith(params: TaskParam[]) {
  const values: Record<string, string | boolean> = {};
  render(
    <ConfirmTaskContent
      message="message"
      command={COMMAND}
      params={params}
      getParamValues={(key, value) => { values[key] = value; }}
    />
  );
  return values;
}

const preview = () => screen.getByText(/curl -XPOST/).textContent;

afterEach(cleanup);

describe("ConfirmTaskContent: duration parameters", () => {
  it("prefills the duration field with its default value and reflects it in the preview", () => {
    const values = renderWith([
      { key: "tiering", defaultValue: "30d", type: "duration" },
      { key: "messagesPerSecond", defaultValue: "50", type: "input" },
    ]);

    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "30");
    expect(preview()).toContain(`${COMMAND}?tiering=30d&messagesPerSecond=50`);
    expect(values.tiering).toBe("30d");
  });

  it("keeps the unit of the default value", () => {
    const values = renderWith([{ key: "tiering", defaultValue: "2w", type: "duration" }]);

    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "2");
    expect(values.tiering).toBe("2w");
  });

  it("drops the duration from the preview once the field is cleared", () => {
    const values = renderWith([{ key: "tiering", defaultValue: "30d", type: "duration" }]);

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });

    expect(preview()).not.toContain("tiering");
    expect(values.tiering).toBe("");
  });

  it("leaves the field empty without a default value", () => {
    const values = renderWith([{ key: "createdBefore", defaultValue: "", type: "duration" }]);

    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "");
    expect(preview()).not.toContain("createdBefore");
    expect(values.createdBefore).toBe("");
  });
});

describe("ConfirmTaskContent: parameter labels", () => {
  it("names every parameter field after its key", () => {
    renderWith([
      { key: "messagesPerSecond", defaultValue: "50", type: "input" },
      { key: "quotaComponent", defaultValue: "", type: "select", values: ["MAILBOX", "SIEVE"] },
      { key: "force", defaultValue: false, type: "checkbox" },
      { key: "tiering", defaultValue: "30d", type: "duration" },
    ]);

    expect(screen.getByLabelText("messagesPerSecond:").tagName).toBe("INPUT");
    expect(screen.getByLabelText("quotaComponent:").getAttribute("role")).toBe("combobox");
    expect(screen.getByLabelText("force:").getAttribute("role")).toBe("checkbox");
    expect(screen.getByLabelText("tiering:")).toBe(screen.getByRole("spinbutton"));
    expect(screen.getByRole("combobox", { name: "tiering unit" })).not.toBeNull();
  });

  it("gives each dialog its own ids so that two of them on a page do not collide", () => {
    const params: TaskParam[] = [{ key: "mode", defaultValue: "", type: "select", values: ["fixed", "rebuildAll"] }];
    renderWith(params);
    renderWith(params);

    const fields = screen.getAllByLabelText("mode:");
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });
});
