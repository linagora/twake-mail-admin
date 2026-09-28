import { describe, expect, it } from "vitest";
import { searchAndPaginate } from "./search-pagination";

const identity = (s: string) => [s];
const items = Array.from({ length: 120 }, (_, i) => `item-${String(i).padStart(3, "0")}`);

describe("searchAndPaginate", () => {
  it("slices the requested page", () => {
    const result = searchAndPaginate(items, "", 2, identity, 50);
    expect(result.paginated).toHaveLength(50);
    expect(result.paginated[0]).toBe("item-050");
    expect(result.offset).toBe(50);
    expect(result.totalPages).toBe(3);
  });

  it("returns the remainder on the last page", () => {
    expect(searchAndPaginate(items, "", 3, identity, 50).paginated).toHaveLength(20);
  });

  it("searches case-insensitively on any searchable field", () => {
    const entries = [{ name: "Sales", email: "sales@x.com" }, { name: "Support", email: "HELP@x.com" }];
    const result = searchAndPaginate(entries, "help", 1, (e) => [e.name, e.email]);
    expect(result.filtered).toEqual([entries[1]]);
  });

  it("ignores missing fields", () => {
    const entries = [{ name: "a", description: undefined }, { name: "b", description: "room" }];
    expect(searchAndPaginate(entries, "room", 1, (e) => [e.name, e.description]).filtered).toEqual([entries[1]]);
  });

  it("clamps the page when the list shrinks", () => {
    const result = searchAndPaginate(items, "item-00", 3, identity, 50);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.paginated).toHaveLength(10);
  });

  it("reports a single page for an empty list", () => {
    const result = searchAndPaginate([], "", 4, identity, 50);
    expect(result).toMatchObject({ page: 1, totalPages: 1, offset: 0, paginated: [] });
  });
});
