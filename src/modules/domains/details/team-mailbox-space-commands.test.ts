import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindSpaceCommand, isUuid, toSpaceBinding, toUtcInstant } from "./team-mailbox-space-commands";

const SPACE_ID = "11111111-1111-1111-1111-111111111111";

describe("team mailbox space binding (Europe/Paris)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Europe/Paris";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("sends the local time typed as a UTC instant without milliseconds", () => {
    expect(toUtcInstant("2026-10-01T10:00")).toBe("2026-10-01T08:00:00Z");
  });

  it("reads an empty or invalid time as no instant", () => {
    expect(toUtcInstant("")).toBe("");
    expect(toUtcInstant("not a date")).toBe("");
  });

  it("binds to an active space without deletedAt, the identifiers trimmed", () => {
    expect(toSpaceBinding({ organizationId: " org-1 ", spaceId: ` ${SPACE_ID} `, deleted: false, deletedAt: "2026-10-01T10:00" }))
      .toEqual({ organizationId: "org-1", spaceId: SPACE_ID });
  });

  it("binds to a deleted space with its deletedAt", () => {
    expect(toSpaceBinding({ organizationId: "org-1", spaceId: SPACE_ID, deleted: true, deletedAt: "2026-10-01T10:00" }))
      .toEqual({ organizationId: "org-1", spaceId: SPACE_ID, deletedAt: "2026-10-01T08:00:00Z" });
  });

  it("previews the call with its JSON content type and body", () => {
    expect(bindSpaceCommand("example.com", "sales", { organizationId: "org-1", spaceId: SPACE_ID, deletedAt: "2026-10-01T08:00:00Z" }))
      .toBe(`curl -XPUT /domains/example.com/team-mailboxes/sales/space -H "Content-Type: application/json" -d '{"organizationId":"org-1","spaceId":"${SPACE_ID}","deletedAt":"2026-10-01T08:00:00Z"}'`);
  });

  it.each([
    [SPACE_ID, true],
    ["A1B2C3D4-0000-4000-8000-000000000000", true],
    ["11111111-1111-1111-1111", false],
    ["space-1", false],
  ])("checks that %s is a UUID", (value, expected) => {
    expect(isUuid(value)).toBe(expected);
  });
});
