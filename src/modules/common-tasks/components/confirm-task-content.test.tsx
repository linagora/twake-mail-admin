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

describe("ConfirmTaskContent: quoted commands", () => {
  it("appends parameters inside the closing quote of the URL", () => {
    render(
      <ConfirmTaskContent
        message="message"
        command="curl -XPATCH '/mailRepositories/var%2Fmail%2Ferror/mails/key-1?action=reprocess'"
        params={[{ key: "queue", defaultValue: "spool", type: "input" }]}
        getParamValues={() => {}}
      />
    );

    expect(screen.getByText(/curl -XPATCH/).textContent).toContain(
      "curl -XPATCH '/mailRepositories/var%2Fmail%2Ferror/mails/key-1?action=reprocess&queue=spool'"
    );
  });
});

describe("ConfirmTaskContent: parameters already present in the command", () => {
  function renderCommand(command: string) {
    render(
      <ConfirmTaskContent
        message="message"
        command={command}
        params={[{ key: "eventsPerSecond", defaultValue: "100", type: "input" }]}
        getParamValues={() => {}}
      />
    );
  }

  const typeRate = (value: string) =>
    fireEvent.change(screen.getByRole("textbox"), { target: { value } });

  it("overrides the value of the base command", () => {
    renderCommand("curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100");

    typeRate("9");

    expect(preview()).toMatch(/curl -XPOST \/calendars\?task=scheduleAlarms&eventsPerSecond=9$/);
  });

  it("removes the parameter of the base command once the field is cleared", () => {
    renderCommand("curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100");

    typeRate("");

    expect(preview()).toMatch(/curl -XPOST \/calendars\?task=scheduleAlarms$/);
  });

  it("keeps the following parameters when removing the first one", () => {
    renderCommand("curl -XPOST '/calendars?eventsPerSecond=100&task=scheduleAlarms'");

    typeRate("");

    expect(preview()).toMatch(/curl -XPOST '\/calendars\?task=scheduleAlarms'$/);
  });
});
