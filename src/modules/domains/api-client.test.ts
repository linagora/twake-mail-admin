import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getRaw: vi.fn(),
}));

import { getDomainAddressBookContactCount } from "./api-client";

describe("domain address book contact count", () => {
  beforeEach(() => {
    http.get.mockReset().mockResolvedValue({ count: 805 });
  });

  it("reads the count of the domain address book", async () => {
    await expect(getDomainAddressBookContactCount("linagora.com", "dab")).resolves.toEqual({ count: 805 });
    expect(http.get).toHaveBeenCalledWith("/domains/linagora.com/addressbooks/dab/contactCount");
  });

  it("reads the count of the domain members", async () => {
    await getDomainAddressBookContactCount("linagora.com", "domain-members");
    expect(http.get).toHaveBeenCalledWith("/domains/linagora.com/addressbooks/domain-members/contactCount");
  });

  it("encodes the domain", async () => {
    await getDomainAddressBookContactCount("a/b", "dab");
    expect(http.get).toHaveBeenCalledWith("/domains/a%2Fb/addressbooks/dab/contactCount");
  });
});
