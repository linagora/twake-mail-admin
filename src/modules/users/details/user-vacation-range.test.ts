import { describe, expect, it } from "vitest";
import { isVacationRangeInvalid } from "./user-vacation-range";
import { VacationSettings } from "../types";

const VACATION: VacationSettings = {
  enabled: true,
  fromDate: "2026-12-10T08:00:00.000Z",
  toDate: "2026-12-01T08:00:00.000Z",
  subject: "Away",
  textBody: "",
  htmlBody: "",
};

describe("isVacationRangeInvalid", () => {
  it("rejects an enabled vacation ending before it starts", () => {
    expect(isVacationRangeInvalid(VACATION)).toBe(true);
  });

  it("rejects an enabled vacation ending when it starts", () => {
    expect(isVacationRangeInvalid({ ...VACATION, toDate: VACATION.fromDate })).toBe(true);
  });

  it("accepts an enabled vacation ending after it starts", () => {
    expect(isVacationRangeInvalid({ ...VACATION, toDate: "2026-12-20T08:00:00.000Z" })).toBe(false);
  });

  it("accepts an open-ended vacation", () => {
    expect(isVacationRangeInvalid({ ...VACATION, toDate: "" })).toBe(false);
    expect(isVacationRangeInvalid({ ...VACATION, fromDate: "" })).toBe(false);
  });

  it("lets an inconsistent vacation be disabled", () => {
    expect(isVacationRangeInvalid({ ...VACATION, enabled: false })).toBe(false);
  });
});
