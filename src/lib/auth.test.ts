// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { BEARER_TOKEN_KEY, getBearerToken, removeBearerToken, setBearerToken } from "./auth";

const LEGACY_COOKIE = "bearer_token=legacy; path=/; max-age=604800";

afterEach(() => {
  sessionStorage.clear();
  document.cookie = "bearer_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("static bearer token storage", () => {
  it("keeps the token for the session of the tab, in no cookie", () => {
    setBearerToken("secret-token");

    expect(getBearerToken()).toBe("secret-token");
    expect(sessionStorage.getItem(BEARER_TOKEN_KEY)).toBe("secret-token");
    expect(document.cookie).not.toContain("secret-token");
  });

  it("has no token before one is set", () => {
    expect(getBearerToken()).toBeNull();
  });

  it("forgets the token on removal", () => {
    setBearerToken("secret-token");

    removeBearerToken();

    expect(getBearerToken()).toBeNull();
  });

  it("ignores the cookie of earlier versions, and drops it on removal", () => {
    document.cookie = LEGACY_COOKIE;
    expect(getBearerToken()).toBeNull();

    removeBearerToken();

    expect(document.cookie).not.toContain("bearer_token");
  });

  it("drops the cookie of earlier versions when a new token is set", () => {
    document.cookie = LEGACY_COOKIE;

    setBearerToken("secret-token");

    expect(document.cookie).not.toContain("bearer_token");
  });
});
