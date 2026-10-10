import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn(), post: http.post, put: vi.fn(), patch: vi.fn(), delete: http.delete },
}));
vi.mock("@/lib/config", () => ({ appConfig: {} }));

import {
  runAllUsersReindexTask,
  runBlobGarbageCollectionTask,
  runCleanupJmapUploadsTask,
  runFixMappingTask,
  summarizeAllUsersReindex,
} from "./api-client";

describe("tasks with a fixed query parameter", () => {
  beforeEach(() => {
    http.post.mockReset();
    http.delete.mockReset();
  });

  it("fixes mapping denormalization", async () => {
    await runFixMappingTask();
    expect(http.post).toHaveBeenCalledWith("/cassandra/mappings?action=SolveInconsistencies");
  });

  it("cleans up expired JMAP uploads", async () => {
    await runCleanupJmapUploadsTask();
    expect(http.delete).toHaveBeenCalledWith("/jmap/uploads?scope=expired");
  });

  it("appends the blob garbage collection parameters with '&'", async () => {
    await runBlobGarbageCollectionTask({ associatedProbability: "0.01", expectedBlobCount: "1000000" });
    expect(http.delete).toHaveBeenCalledWith(
      "/blobs?scope=unreferenced&associatedProbability=0.01&expectedBlobCount=1000000"
    );
  });
});

describe("per user reindexing", () => {
  beforeEach(() => {
    http.post.mockReset();
  });

  it("schedules a rebuildAll reindexing of every user", async () => {
    http.post.mockResolvedValue({ taskIds: {}, erroredUsers: [] });
    await runAllUsersReindexTask({ messagesPerSecond: "50" });
    expect(http.post).toHaveBeenCalledWith("/users?action=reindex&mode=rebuildAll&messagesPerSecond=50");
  });

  it("counts one planned task per user in taskIds", () => {
    const taskIds = Object.fromEntries(
      ["alice", "bob", "charlotte", "david", "eve", "frank", "grace", "heidi"].map((name, index) => [
        `${name}@example.com`,
        `task-${index}`,
      ])
    );
    expect(summarizeAllUsersReindex({ taskIds, erroredUsers: [] })).toEqual({ planned: 8, errors: 0 });
  });

  it("counts the errored users", () => {
    expect(
      summarizeAllUsersReindex({ taskIds: { "alice@example.com": "task-1" }, erroredUsers: ["bob@example.com"] })
    ).toEqual({ planned: 1, errors: 1 });
  });

  it("tolerates an empty response", () => {
    expect(summarizeAllUsersReindex(undefined)).toEqual({ planned: 0, errors: 0 });
    expect(summarizeAllUsersReindex({})).toEqual({ planned: 0, errors: 0 });
  });
});
