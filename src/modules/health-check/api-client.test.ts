import { describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({ apiClient: { get: http.get } }));

import { getHealthCheck } from "./api-client";

describe("health check request", () => {
  it.each([
    [200, true],
    [503, true],
    [500, false],
    [401, false],
  ])("treats HTTP %i as an answer: %s", async (status, accepted) => {
    http.get.mockReset().mockResolvedValue({ status: "unhealthy", checks: [] });
    await getHealthCheck();

    const [url, config] = http.get.mock.calls[0];
    expect(url).toBe("/healthcheck");
    expect(config.validateStatus(status)).toBe(accepted);
  });
});
