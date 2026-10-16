// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("../api-client", () => ({
  getUserIdentities: async () => [
    { id: "1", name: "Bob", email: "bob@example.com", textSignature: "", htmlSignature: "", sortOrder: 0, mayDelete: true },
  ],
  createUserIdentity: vi.fn(),
  updateUserIdentity: vi.fn(),
  deleteUserIdentity: vi.fn(),
}));

import UserIdentities from "./user-identities";

const FIELDS: [string, string][] = [
  ["users.identities.name", "INPUT"],
  ["users.identities.sortOrder", "INPUT"],
  ["users.identities.textSignature", "TEXTAREA"],
  ["users.identities.htmlSignature", "TEXTAREA"],
];

function openSection() {
  render(<UserIdentities username="bob@example.com" />);
  fireEvent.click(screen.getByText("users.identities.title"));
}

afterEach(cleanup);

describe("user identities: field labels", () => {
  it.each([...FIELDS, ["users.identities.email", "INPUT"]])("names the %s field of the create form", async (label, tagName) => {
    openSection();
    fireEvent.click(screen.getByTitle("users.identities.createButton"));

    expect((await screen.findByLabelText(label)).tagName).toBe(tagName);
  });

  it.each(FIELDS)("names the %s field of the edit dialog", async (label, tagName) => {
    openSection();
    fireEvent.click(await screen.findByTitle("users.identities.editTooltip"));

    expect((await screen.findByLabelText(label)).tagName).toBe(tagName);
  });
});

describe("user identities: details", () => {
  it("exposes each identity as a keyboard reachable button opening its details", async () => {
    openSection();

    const identityButton = await screen.findByRole("button", { name: "Bob <bob@example.com>" });
    identityButton.focus();
    expect(document.activeElement).toBe(identityButton);

    fireEvent.click(identityButton);

    expect(await screen.findByRole("dialog")).not.toBeNull();
  });
});

describe("user identities: long values", () => {
  it("lets the identity name wrap inside a shrinkable row instead of widening the page", async () => {
    openSection();

    const identityButton = await screen.findByRole("button", { name: "Bob <bob@example.com>" });

    expect(identityButton.className).toContain("break-all");
    expect(identityButton.closest("h4")?.parentElement?.className).toContain("min-w-0");
  });
});
