// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
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
import { createUserIdentity } from "../api-client";

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

  it("returns the focus to the identity that opened the details once they are closed", async () => {
    openSection();

    const identityButton = await screen.findByRole("button", { name: "Bob <bob@example.com>" });
    identityButton.focus();
    fireEvent.click(identityButton);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Radix moves the focus on close from a timeout
    await waitFor(() => expect(document.activeElement).toBe(identityButton));
  });

  it("returns the focus to the identity once the edit dialog opened from its details is closed", async () => {
    openSection();

    const identityButton = await screen.findByRole("button", { name: "Bob <bob@example.com>" });
    identityButton.focus();
    fireEvent.click(identityButton);
    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.keyDown(await screen.findByLabelText("users.identities.name"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(identityButton));
  });
});

describe("user identities: edit dialog", () => {
  it("is titled with the name of the identity, like its details", async () => {
    openSection();
    fireEvent.click(await screen.findByTitle("users.identities.editTooltip"));

    expect((await screen.findByRole("dialog")).textContent).toContain('users.identities.editTitle {"name":"Bob"}');
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

describe("user identities: Enter in a field", () => {
  // jsdom does not submit a form on Enter: submitting the field's form is what the browser does then
  it("creates the identity, like Create", async () => {
    openSection();
    fireEvent.click(screen.getByTitle("users.identities.createButton"));

    fireEvent.change(screen.getByLabelText("users.identities.name"), { target: { value: "Bob QA" } });
    const email = screen.getByLabelText("users.identities.email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "bob@example.com" } });
    fireEvent.submit(email.form!);

    await waitFor(() => expect(createUserIdentity).toHaveBeenCalledWith("bob@example.com", expect.objectContaining({ name: "Bob QA", email: "bob@example.com" })));
  });
});
