import { describe, expect, it } from "vitest";
import { isKnownResourceIcon, resourceDisplayName } from "./resource-display";

describe("resourceDisplayName", () => {
  it("uses the name when present", () => {
    expect(resourceDisplayName({ id: "r1", name: "Room" })).toBe("Room");
  });

  it.each([null, ""])("falls back to the ID when the name is %j", (name) => {
    expect(resourceDisplayName({ id: "r1", name })).toBe("r1");
  });
});

describe("isKnownResourceIcon", () => {
  it("accepts an icon of the picker", () => {
    expect(isKnownResourceIcon("projector")).toBe(true);
  });

  it.each([null, undefined, "", "../../etc"])("rejects %j", (icon) => {
    expect(isKnownResourceIcon(icon)).toBe(false);
  });
});
