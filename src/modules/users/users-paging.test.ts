import { describe, expect, it, vi } from "vitest";
import { applyUsersRequest, fetchUsersPage, UsersPageRequest } from "./users-paging";

const NO_FILTER = { query: "", domain: "" };
const users = ["carol@b.org", "alice@a.com", "bob@a.com", "Bernard@b.org", "albert@b.org", "admin"];

describe("applyUsersRequest", () => {
  const apply = (request: Partial<UsersPageRequest>) =>
    applyUsersRequest(users, { ...NO_FILTER, limit: 10, ...request });

  it("sorts usernames", () => {
    expect(apply({})).toEqual(["Bernard@b.org", "admin", "albert@b.org", "alice@a.com", "bob@a.com", "carol@b.org"]);
  });

  it("matches the beginning of the username, case insensitively", () => {
    expect(apply({ query: "AL" })).toEqual(["albert@b.org", "alice@a.com"]);
    expect(apply({ query: "a.com" })).toEqual([]);
  });

  it("keeps only users of the domain, case insensitively", () => {
    expect(apply({ domain: "B.ORG" })).toEqual(["Bernard@b.org", "albert@b.org", "carol@b.org"]);
  });

  it("combines query and domain", () => {
    expect(apply({ query: "a", domain: "b.org" })).toEqual(["albert@b.org"]);
  });

  it("returns users strictly after the anchor", () => {
    expect(apply({ anchor: "alice@a.com" })).toEqual(["bob@a.com", "carol@b.org"]);
  });

  it("caps the result to the limit", () => {
    expect(apply({ limit: 2 })).toEqual(["Bernard@b.org", "admin"]);
  });
});

describe("fetchUsersPage", () => {
  const usernames = Array.from({ length: 7 }, (_, i) => `user${i}@a.com`);

  it("requests one more user than the page size to detect a next page", async () => {
    const source = vi.fn().mockResolvedValue(usernames.slice(1, 5));

    const page = await fetchUsersPage(source, { query: " us ", domain: "a.com" }, 3, "user0@a.com");

    expect(source).toHaveBeenCalledWith({ query: "us", domain: "a.com", limit: 4, anchor: "user0@a.com" });
    expect(page).toEqual({ usernames: usernames.slice(1, 4), hasNext: true });
  });

  it("detects the last page", async () => {
    const page = await fetchUsersPage(async () => usernames.slice(5), NO_FILTER, 3);

    expect(page).toEqual({ usernames: usernames.slice(5), hasNext: false });
  });

  it("pages client side when the backend ignores the paging parameters", async () => {
    const page = await fetchUsersPage(async () => [...usernames].reverse(), NO_FILTER, 3, "user2@a.com");

    expect(page).toEqual({ usernames: usernames.slice(3, 6), hasNext: true });
  });
});
