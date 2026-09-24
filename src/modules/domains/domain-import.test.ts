import { describe, expect, it, vi } from "vitest";
import { importDomains, parseDomainList } from "./domain-import";

describe("parseDomainList", () => {
  it("reads one domain per line, LF or CRLF", () => {
    expect(parseDomainList("a.com\nb.com\r\nc.com")).toEqual(["a.com", "b.com", "c.com"]);
  });

  it("skips blank lines and comment-only lines", () => {
    expect(parseDomainList("# header\n\n   \n// note\na.com\n")).toEqual(["a.com"]);
  });

  it("strips comments following a domain on the same line", () => {
    expect(parseDomainList("a.com # main\nb.com// legacy\n  c.com  ")).toEqual(["a.com", "b.com", "c.com"]);
  });

  it("drops duplicates", () => {
    expect(parseDomainList("a.com\na.com")).toEqual(["a.com"]);
  });
});

describe("importDomains", () => {
  it("creates only missing domains and counts outcomes", async () => {
    const create = vi.fn(async (domain: string) => {
      if (domain === "bad.com") throw new Error("boom");
    });
    const onProgress = vi.fn();

    const result = await importDomains(["new.com", "Existing.com", "bad.com"], ["existing.com"], create, onProgress);

    expect(create.mock.calls.map(([domain]) => domain)).toEqual(["new.com", "bad.com"]);
    expect(result).toEqual({
      created: 1,
      alreadyExisting: 1,
      failures: [{ domain: "bad.com", reason: "boom" }],
      processed: 3,
      total: 3,
    });
    expect(onProgress.mock.calls.map(([progress]) => progress.processed)).toEqual([1, 2, 3]);
  });
});
