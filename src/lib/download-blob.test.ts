// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download-blob";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the Blob under the given name, then revokes its object URL", () => {
    const blob = new Blob(["Subject: hello\r\n\r\nbody"]);
    window.URL.createObjectURL = vi.fn(() => "blob:mail");
    window.URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.getAttribute("href")).toBe("blob:mail");
      expect(this.getAttribute("download")).toBe("mail-1.eml");
      expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    downloadBlob(blob, "mail-1.eml");

    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mail");
  });

  it("leaves no link in the document", () => {
    window.URL.createObjectURL = vi.fn(() => "blob:mail");
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "mail-1.eml");

    expect(document.querySelector("a[download]")).toBeNull();
  });
});
