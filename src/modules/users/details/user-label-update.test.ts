import { describe, expect, it } from "vitest";
import { buildLabelUpdatePayload, isColorClearAttempt } from "./user-label-update";
import { UserLabel } from "../types";

const LABEL: UserLabel = {
  id: "1",
  displayName: "Work",
  keyword: "work",
  color: "#ff0000",
  description: "Work emails",
  readOnly: false,
};

describe("buildLabelUpdatePayload", () => {
  it("sends the trimmed colour when one is provided", () => {
    const payload = buildLabelUpdatePayload({ displayName: "Work", color: " #00ff00 ", description: "", readOnly: false });

    expect(payload.color).toBe("#00ff00");
  });

  it("does not send a colour when the field is empty, since the backend cannot unset it", () => {
    const payload = buildLabelUpdatePayload({ displayName: "Work", color: "  ", description: "Work emails v2", readOnly: false });

    expect(payload).not.toHaveProperty("color");
    expect(payload).toEqual({ displayName: "Work", description: "Work emails v2", readOnly: false });
  });
});

describe("isColorClearAttempt", () => {
  it("detects an emptied colour on a coloured label", () => {
    expect(isColorClearAttempt(LABEL, { displayName: "Work", color: "" })).toBe(true);
  });

  it("is false when a colour is kept", () => {
    expect(isColorClearAttempt(LABEL, { displayName: "Work", color: "#ff0000" })).toBe(false);
  });

  it("is false when the label had no colour", () => {
    expect(isColorClearAttempt({ ...LABEL, color: undefined }, { displayName: "Work", color: "" })).toBe(false);
  });
});
