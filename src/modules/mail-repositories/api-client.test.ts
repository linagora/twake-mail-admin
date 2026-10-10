import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: http.patch, delete: vi.fn() },
}));

import { reprocessMailRepository } from "./api-client";

describe("reprocess mail repository", () => {
  beforeEach(() => {
    http.patch.mockReset().mockResolvedValue({ taskId: "task-1" });
  });

  it("defaults to the root processor", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror");
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&processor=root"
    );
  });

  it("sends the processor once and drops blank parameters", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", {
      queue: "spool",
      processor: "transport",
      consume: true,
      limit: "" as unknown as number,
      maxRetries: "" as unknown as number,
    });
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&processor=transport&queue=spool&consume=true"
    );
  });

  it("keeps numeric limits", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", { limit: 10, maxRetries: 3 });
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&processor=root&limit=10&maxRetries=3"
    );
  });
});
