import { describe, expect, it } from "vitest";
import { parseQuotaUsageSum } from "./quota-usage";

describe("parseQuotaUsageSum", () => {
  it("accepts a usage sum", () => {
    expect(parseQuotaUsageSum({ count: 5, size: 2755 })).toEqual({ count: 5, size: 2755 });
  });

  it("accepts an empty usage sum", () => {
    expect(parseQuotaUsageSum({ count: 0, size: 0 })).toEqual({ count: 0, size: 0 });
  });

  it("rejects the domain quota limits payload", () => {
    const limits = {
      global: { count: null, size: null },
      domain: { count: null, size: null },
      computed: { count: null, size: null },
    };

    expect(parseQuotaUsageSum(limits)).toBeNull();
  });

  it("rejects missing or non numeric fields", () => {
    expect(parseQuotaUsageSum({ count: 5 })).toBeNull();
    expect(parseQuotaUsageSum({ count: "5", size: 10 })).toBeNull();
    expect(parseQuotaUsageSum({ count: null, size: null })).toBeNull();
  });

  it("rejects non object answers", () => {
    expect(parseQuotaUsageSum(null)).toBeNull();
    expect(parseQuotaUsageSum(undefined)).toBeNull();
    expect(parseQuotaUsageSum("")).toBeNull();
  });
});
