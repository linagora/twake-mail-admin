// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getDomainSignatureTemplates: vi.fn(),
  updateDomainSignatureTemplates: vi.fn(),
  deleteDomainSignatureTemplates: vi.fn(),
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("../api-client", () => api);

import DomainSignatureTemplates from "./domain-signature-templates";

async function openSection() {
  render(<DomainSignatureTemplates domain="linagora.com" />);
  fireEvent.click(screen.getByRole("button", { name: /domains.signatureTemplates.title/ }));
  await screen.findByRole("button", { name: "domains.signatureTemplates.addTemplate" });
}

beforeEach(() => {
  api.getDomainSignatureTemplates.mockReset();
  api.getDomainSignatureTemplates.mockResolvedValue([]);
});

afterEach(cleanup);

describe("domain signature templates accessibility", () => {
  it("names the add button after its action", async () => {
    await openSection();

    expect(screen.queryByRole("button", { name: "domains.signatureTemplates.languageCode" })).toBeNull();
  });

  it("ties every field of a new template to its visible label", async () => {
    await openSection();

    fireEvent.click(screen.getByRole("button", { name: "domains.signatureTemplates.addTemplate" }));

    expect(screen.getByLabelText("domains.signatureTemplates.languageCode").tagName).toBe("INPUT");
    expect(screen.getByLabelText("domains.signatureTemplates.textSignature").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("domains.signatureTemplates.htmlSignature").tagName).toBe("TEXTAREA");
  });

  it("names each row remove button after its template", async () => {
    api.getDomainSignatureTemplates.mockResolvedValue([
      { language: "en", textSignature: "", htmlSignature: "" },
      { language: "fr", textSignature: "", htmlSignature: "" },
    ]);
    await openSection();
    await screen.findByText("en");

    expect(screen.getAllByRole("button", { name: "domains.signatureTemplates.removeTemplate" })).toHaveLength(2);
  });
});

describe("domain signature templates: save changes", () => {
  const saveButton = () => screen.queryByRole("button", { name: "domains.signatureTemplates.saveChanges" });

  it("is hidden again once an added template is removed", async () => {
    await openSection();

    fireEvent.click(screen.getByRole("button", { name: "domains.signatureTemplates.addTemplate" }));
    fireEvent.change(screen.getByLabelText("domains.signatureTemplates.languageCode"), { target: { value: "fr" } });
    expect(saveButton()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "domains.signatureTemplates.removeTemplate" }));
    expect(saveButton()).toBeNull();
  });

  it("is hidden again once an edited field is typed back to its saved value", async () => {
    api.getDomainSignatureTemplates.mockResolvedValue([{ language: "en", textSignature: "Bye", htmlSignature: "" }]);
    await openSection();
    fireEvent.click(await screen.findByText("en"));

    const text = screen.getByLabelText("domains.signatureTemplates.textSignature");
    fireEvent.change(text, { target: { value: "Bye!" } });
    expect(saveButton()).not.toBeNull();

    fireEvent.change(text, { target: { value: "Bye" } });
    expect(saveButton()).toBeNull();
  });
});
