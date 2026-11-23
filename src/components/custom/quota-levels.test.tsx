// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.domain ? `${key}:${options.domain}` : key),
  }),
}));

import { appliedLevel, isLimited, QuotaLevel, QuotaLevelRows, QuotaOccupation } from "./quota-levels";

const MB = 1024 * 1024;
const levels = (user: QuotaLevel["values"], domain: QuotaLevel["values"], global: QuotaLevel["values"]): QuotaLevel[] => [
  { source: "user", label: "User", values: user },
  { source: "domain", label: "Domain example.com", values: domain, domain: "example.com" },
  { source: "global", label: "Global", values: global },
];
const OCCUPATION = { count: 2, size: 1100, ratio: { count: 0.002, size: 0.01, max: 0.01 } };

afterEach(cleanup);

describe("quota levels", () => {
  it("applies the most specific level setting each limit", () => {
    const set = levels({ count: 1000, size: null }, { count: null, size: 2048 * MB }, null);
    expect(appliedLevel(set, "count")?.source).toBe("user");
    expect(appliedLevel(set, "size")?.source).toBe("domain");
    expect(isLimited(set)).toBe(true);
  });

  it("says where each applied limit comes from, and — for a level setting nothing", () => {
    render(<QuotaLevelRows levels={levels({ count: 1000, size: null }, { count: null, size: 2048 * MB }, null)} />);
    expect(screen.getByText("quota.fromUser")).not.toBeNull();
    expect(screen.getByText("quota.fromDomain:example.com")).not.toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("reads unlimited, without a ratio, when no limit is set anywhere", () => {
    const none = levels(null, null, { count: null, size: null });
    render(<><QuotaLevelRows levels={none} /><QuotaOccupation occupation={OCCUPATION} levels={none} /></>);
    expect(screen.getAllByText("quota.noLimitSet")).toHaveLength(2);
    expect(screen.queryByText("common.ratio")).toBeNull();
  });

  it("names a limit explicitly set to unlimited after its level", () => {
    const set = levels({ count: -1, size: -1 }, null, null);
    render(<QuotaLevelRows levels={set} />);
    expect(isLimited(set)).toBe(false);
    expect(screen.getAllByText("quota.fromUser")).toHaveLength(2);
  });

  it("shows a zero limit with some usage as full, with a hint", () => {
    const zero = levels({ count: 0, size: null }, null, null);
    const used = { count: 2, size: 1100, ratio: { count: NaN, size: 0, max: NaN } };
    const { container } = render(<QuotaOccupation occupation={used} levels={zero} />);
    expect(screen.getByText("quota.zeroLimit")).not.toBeNull();
    expect(container.textContent).toMatch(/100/);
    expect(container.textContent).not.toMatch(/NaN|∞|Infinity/);
    expect(container.querySelector(".bg-red-500")).not.toBeNull();
  });

  it("shows a zero limit without usage as empty, with a hint", () => {
    const zero = levels({ count: 0, size: 0 }, null, null);
    const empty = { count: 0, size: 0, ratio: { count: NaN, size: NaN, max: NaN } };
    const { container } = render(<QuotaOccupation occupation={empty} levels={zero} />);
    expect(screen.getByText("quota.zeroLimit")).not.toBeNull();
    expect(container.textContent).not.toMatch(/NaN/);
    expect(container.querySelector(".bg-green-500")).not.toBeNull();
  });

  it("shows no ratio for an unlimited quota", () => {
    const unlimited = levels({ count: -1, size: -1 }, null, null);
    render(<QuotaOccupation occupation={OCCUPATION} levels={unlimited} />);
    expect(screen.queryByText("common.ratio")).toBeNull();
  });

  it("works the ratio out from the limit when the backend answers NaN", () => {
    const set = levels({ count: 4, size: null }, null, null);
    const occupation = { count: 2, size: 1100, ratio: { count: "NaN", size: "NaN", max: "NaN" } } as unknown as typeof OCCUPATION;
    const { container } = render(<QuotaOccupation occupation={occupation} levels={set} />);
    expect(container.textContent).toMatch(/50/);
    expect(container.textContent).not.toMatch(/NaN/);
  });
});
