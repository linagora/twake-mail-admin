import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getRaw: vi.fn(),
}));

import { getUsers, listUsernames } from "./api-client";

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
