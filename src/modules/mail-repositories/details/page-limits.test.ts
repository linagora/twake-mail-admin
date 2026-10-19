import { describe, expect, it } from "vitest";
import { extendedPageOf } from "./page-limits";

describe("extended view page of a basic view page", () => {
  it.each([
    [1, 1],
    [2, 5],
    [3, 9],
  ])("basic page %i opens extended page %i", (basicPage, extendedPage) => {
    expect(extendedPageOf(basicPage)).toBe(extendedPage);
  });
});
