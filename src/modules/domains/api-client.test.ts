import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getRaw: vi.fn(),
}));

import { getDomainAddressBookContactCount, getDomainSignatureTemplates } from "./api-client";

describe("domain signature templates", () => {
  const template = { language: "en", textSignature: "Regards", htmlSignature: "<p>Regards</p>" };

  beforeEach(() => {
    http.get.mockReset();
  });

  it("reads the signature templates of the domain", async () => {
    http.get.mockResolvedValue({ signatures: [template] });
    await expect(getDomainSignatureTemplates("linagora.com")).resolves.toEqual([template]);
    expect(http.get).toHaveBeenCalledWith("/domains/linagora.com/signature-templates");
  });

  it("reads no signature template when the domain has none", async () => {
    http.get.mockRejectedValue({ response: { status: 404 } });
    await expect(getDomainSignatureTemplates("linagora.com")).resolves.toEqual([]);
  });

  it("propagates other errors", async () => {
    const error = { response: { status: 500 } };
    http.get.mockRejectedValue(error);
    await expect(getDomainSignatureTemplates("linagora.com")).rejects.toBe(error);
  });
});

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
