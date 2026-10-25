import { describe, expect, it } from "vitest";
import { Users } from "lucide-react";
import { visibleNavGroups } from "./nav-groups";

const entry = (url: string) => ({ title: url, url, icon: Users });

describe("visibleNavGroups", () => {
  const groups = [
    { label: "A", items: [entry("/a1"), entry("/a2")] },
    { label: "B", items: [entry("/b1")] },
  ];

  it("keeps the entries that are allowed or not listed", () => {
    expect(visibleNavGroups(groups, { "/a1": true })).toEqual(groups);
  });

  it("hides the denied entries and the groups left empty", () => {
    expect(visibleNavGroups(groups, { "/a2": false, "/b1": false })).toEqual([
      { label: "A", items: [entry("/a1")] },
    ]);
  });
});
