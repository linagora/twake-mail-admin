import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getRaw: vi.fn(),
}));

import { getUsers } from "./api-client";
import { getUserPage, toUserPage } from "./user-pages";

const users = (...usernames: string[]) => usernames.map((username) => ({ username }));

describe("getUsers", () => {
  beforeEach(() => {
    http.get.mockReset();
    http.get.mockResolvedValue([]);
  });

  it("lists every user when no parameter is given", async () => {
    await getUsers();
    expect(http.get).toHaveBeenCalledWith("/users");
  });

  it("passes limit, anchor and query", async () => {
    await getUsers({ limit: 51, anchor: "bob@x.com", query: "b&o" });
    expect(http.get).toHaveBeenCalledWith("/users?limit=51&anchor=bob%40x.com&query=b%26o");
  });

  it("omits empty anchor and query", async () => {
    await getUsers({ limit: 51, anchor: "", query: "" });
    expect(http.get).toHaveBeenCalledWith("/users?limit=51");
  });
});

describe("toUserPage", () => {
  it("keeps a server page as is", () => {
    expect(toUserPage(users("a", "b"), { limit: 2 })).toEqual({ users: users("a", "b"), hasNext: false });
  });

  it("detects a next page from the extra user", () => {
    expect(toUserPage(users("a", "b", "c"), { limit: 2 })).toEqual({ users: users("a", "b"), hasNext: true });
  });

  it("paginates client side a full list returned by an older James", () => {
    const legacy = users("dave", "Carol", "alice", "bob", "eve");
    expect(toUserPage(legacy, { limit: 2, anchor: "alice" })).toEqual({ users: users("bob", "dave"), hasNext: true });
  });

  it("searches client side case-insensitively when the server ignored the query", () => {
    const legacy = users("bob", "BOBBY", "alice");
    expect(toUserPage(legacy, { limit: 2, query: "bob" })).toEqual({ users: users("BOBBY", "bob"), hasNext: false });
  });

  it("does not mutate the response", () => {
    const response = users("b", "a");
    toUserPage(response, { limit: 2 });
    expect(response).toEqual(users("b", "a"));
  });
});

describe("getUserPage", () => {
  beforeEach(() => {
    http.get.mockReset();
  });

  it("asks one user more than the page size", async () => {
    http.get.mockResolvedValue(users("xb", "xc", "xd"));
    await expect(getUserPage({ limit: 2, anchor: "a", query: "x" }))
      .resolves.toEqual({ users: users("xb", "xc"), hasNext: true });
    expect(http.get).toHaveBeenCalledWith("/users?limit=3&anchor=a&query=x");
  });

  it("propagates errors such as an invalid anchor", async () => {
    http.get.mockRejectedValue(new Error("Request failed with status code 400"));
    await expect(getUserPage({ limit: 2 })).rejects.toThrow("400");
  });
});
