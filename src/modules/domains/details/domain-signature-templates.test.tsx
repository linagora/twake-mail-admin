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
