import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: http.post, put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getRaw: vi.fn(),
}));

import { getUsers, listUsernames, reindexUserMailboxes } from "./api-client";

describe("user list", () => {
  beforeEach(() => {
    http.get.mockReset();
    http.get.mockResolvedValue([{ username: "bob@linagora.com" }]);
  });

  it("lists every user without parameters", async () => {
    await getUsers();
    expect(http.get).toHaveBeenCalledWith("/users");
  });

  it("passes the paging, search and domain parameters URL encoded", async () => {
    await getUsers({ limit: 51, anchor: "bob+1@linagora.com", query: "b&o", domain: "linagora.com" });
    expect(http.get).toHaveBeenCalledWith(
      "/users?limit=51&anchor=bob%2B1%40linagora.com&query=b%26o&domain=linagora.com"
    );
  });

  it("omits empty parameters", async () => {
    await getUsers({ limit: 51, anchor: undefined, query: "", domain: "" });
    expect(http.get).toHaveBeenCalledWith("/users?limit=51");
  });

  it("extracts the usernames", async () => {
    await expect(listUsernames()).resolves.toEqual(["bob@linagora.com"]);
  });
});

describe("user mailboxes reindexing", () => {
  beforeEach(() => {
    http.post.mockReset();
    http.post.mockResolvedValue({ taskId: "1" });
  });

  it("does not force by default: WebAdmin checks that the user exists", async () => {
    await reindexUserMailboxes("bob@linagora.com", { messagesPerSecond: "50" });
    expect(http.post).toHaveBeenCalledWith("/users/bob%40linagora.com/mailboxes?task=reIndex&messagesPerSecond=50");
  });

  it("sends force when asked, to reindex an unknown user", async () => {
    await reindexUserMailboxes("bob@linagora.com", { mode: "rebuildAll", force: true });
    expect(http.post).toHaveBeenCalledWith("/users/bob%40linagora.com/mailboxes?task=reIndex&mode=rebuildAll&force=");
  });
});
