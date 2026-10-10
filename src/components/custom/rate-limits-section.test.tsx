// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RATE_LIMIT_KEYS, normalizeRateLimits } from "./rate-limits";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import RateLimitsSection from "./rate-limits-section";

afterEach(cleanup);

describe("rate limits section: field labels", () => {
  it("names every field after its visible label", async () => {
    render(
      <RateLimitsSection
        fetchRateLimits={async () => normalizeRateLimits(null)}
        updateRateLimits={async () => {}}
        defaultOpen
      />
    );

    for (const key of RATE_LIMIT_KEYS) {
      const field = await screen.findByLabelText(`rateLimits.${key}`);
      expect(field.tagName).toBe("INPUT");
    }
  });

  it("gives each section its own ids so that two sections on a page do not collide", async () => {
    const props = { fetchRateLimits: async () => normalizeRateLimits(null), updateRateLimits: async () => {}, defaultOpen: true };
    render(
      <>
        <RateLimitsSection {...props} />
        <RateLimitsSection {...props} />
      </>
    );

    const fields = await screen.findAllByLabelText(`rateLimits.${RATE_LIMIT_KEYS[0]}`);
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });
});
