import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ put: vi.fn(), delete: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: http.put, patch: vi.fn(), delete: http.delete },
}));

import { createDomainMapping, deleteDomainMapping } from "./api-client";

describe("domain mappings", () => {
  beforeEach(() => {
    http.put.mockReset().mockResolvedValue(undefined);
    http.delete.mockReset().mockResolvedValue(undefined);
  });

  it("creates a domain mapping with the destination as plain text body", async () => {
    await createDomainMapping("qa-imp1.test", "example.com");
    expect(http.put).toHaveBeenCalledWith("/domainMappings/qa-imp1.test", "example.com", {
      headers: { "Content-Type": "text/plain" },
    });
  });

  it("removes a domain mapping with the destination as plain text body", async () => {
    await deleteDomainMapping("qa-imp1.test", "example.com");
    expect(http.delete).toHaveBeenCalledWith("/domainMappings/qa-imp1.test", {
      data: "example.com",
      headers: { "Content-Type": "text/plain" },
    });
  });

  it("propagates removal errors", async () => {
    const error = { response: { status: 400 } };
    http.delete.mockRejectedValue(error);
    await expect(deleteDomainMapping("qa-imp1.test", "example.com")).rejects.toBe(error);
  });
});
