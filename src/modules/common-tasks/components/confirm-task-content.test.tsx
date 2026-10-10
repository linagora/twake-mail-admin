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
