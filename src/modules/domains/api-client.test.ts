import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: http.post, put: vi.fn(), patch: vi.fn(), delete: http.delete },
  getRaw: vi.fn(),
}));

import {
  clearDomainAddressBook,
  copyIntoDomainAddressBook,
  exportDomainAddressBook,
  getDomainAddressBookContactCount,
  getDomainSignatureTemplates,
  importDomainAddressBook,
} from "./api-client";

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

describe("domain address book export and import", () => {
  beforeEach(() => {
    http.post.mockReset();
  });

  it("exports the address book as a vCard blob", async () => {
    const vcards = new Blob(["BEGIN:VCARD"]);
    http.post.mockResolvedValue(vcards);

    await expect(exportDomainAddressBook("linagora.com", "domain-members")).resolves.toBe(vcards);
    expect(http.post).toHaveBeenCalledWith(
      "/domains/linagora.com/addressbooks/domain-members?action=export",
      undefined,
      { headers: { Accept: "text/vcard" }, responseType: "blob" }
    );
  });

  it("imports vCards as the raw body and returns the task", async () => {
    http.post.mockResolvedValue({ taskId: "6d3bb34e" });

    await expect(importDomainAddressBook("a/b", "dab", "BEGIN:VCARD")).resolves.toEqual({ taskId: "6d3bb34e" });
    expect(http.post).toHaveBeenCalledWith(
      "/domains/a%2Fb/addressbooks/dab?action=import",
      "BEGIN:VCARD",
      { headers: { "Content-Type": "text/vcard" } }
    );
  });
});

describe("domain address book clear", () => {
  beforeEach(() => {
    http.delete.mockReset();
    http.delete.mockResolvedValue({ taskId: "6d3bb34e" });
  });

  it("clears all the contacts and returns the task", async () => {
    await expect(clearDomainAddressBook("a/b", "dab")).resolves.toEqual({ taskId: "6d3bb34e" });
    expect(http.delete).toHaveBeenCalledWith("/domains/a%2Fb/addressbooks/dab/contacts");
  });

  it("restricts the clear to a source domain", async () => {
    await clearDomainAddressBook("school.org", "dab", "student.school.org");
    expect(http.delete).toHaveBeenCalledWith(
      "/domains/school.org/addressbooks/dab/contacts?sourceDomain=student.school.org"
    );
  });
});

describe("domain address book copy", () => {
  beforeEach(() => {
    http.post.mockReset();
    http.post.mockResolvedValue({ taskId: "6d3bb34e" });
  });

  it("copies the users of the source domain and returns the task", async () => {
    await expect(copyIntoDomainAddressBook("a/b", "dab", "students.school.org")).resolves.toEqual({ taskId: "6d3bb34e" });
    expect(http.post).toHaveBeenCalledWith(
      "/domains/a%2Fb/addressbooks/dab?action=copyFrom&sourceDomain=students.school.org"
    );
  });

  it("encodes the LDAP filter", async () => {
    await copyIntoDomainAddressBook("teachers.school.org", "dab", "students.school.org", "(employeeType=student)");
    expect(http.post).toHaveBeenCalledWith(
      "/domains/teachers.school.org/addressbooks/dab?action=copyFrom&sourceDomain=students.school.org&ldapFilter=%28employeeType%3Dstudent%29"
    );
  });
});
