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
  getUserLabels: async () => [
    {
      id: "1",
      displayName: "Important",
      keyword: "8b0c5e3a-9d4e-4f8c-b1a2-6c3d7e9f0a1b",
      color: "#ff0000",
      description: "Mails to handle first",
      readOnly: true,
    },
  ],
  createUserLabel: vi.fn(),
  updateUserLabel: vi.fn(),
  deleteUserLabel: vi.fn(),
}));

import UserLabels from "./user-labels";
import { createUserLabel, updateUserLabel } from "../api-client";

afterEach(cleanup);

describe("user labels: phone layout", () => {
  it("keeps only the display name, color and actions as columns below md, the other values under the name", async () => {
    render(<UserLabels username="bob@example.com" />);
    fireEvent.click(screen.getByText("users.labels.title"));

    const editButton = await screen.findByTitle("users.labels.editTooltip");
    const row = editButton.closest("tr")!;
    const visibleOnPhone = Array.from(row.children).filter((cell) => !cell.className.includes("hidden md:table-cell"));
    expect(visibleOnPhone).toHaveLength(3);
    expect(visibleOnPhone[2].contains(editButton)).toBe(true);
    expect(visibleOnPhone[2].contains(screen.getByTitle("users.labels.deleteTooltip"))).toBe(true);

    const phoneDetails = screen.getByTestId("label-phone-details");
    expect(phoneDetails.className).toContain("md:hidden");
    expect(phoneDetails.textContent).toContain("8b0c5e3a-9d4e-4f8c-b1a2-6c3d7e9f0a1b");
    expect(phoneDetails.textContent).toContain("users.labels.readOnly");
    expect(phoneDetails.textContent).toContain("Mails to handle first");
  });
});

describe("user labels: row buttons", () => {
  it("names the edit and delete buttons after the label, the tooltips staying short", async () => {
    render(<UserLabels username="bob@example.com" />);
    fireEvent.click(screen.getByText("users.labels.title"));

    const item = JSON.stringify({ item: "Important" });
    const edit = await screen.findByRole("button", { name: `users.labels.editNamed ${item}` });
    const remove = screen.getByRole("button", { name: `users.labels.deleteNamed ${item}` });
    expect(edit.getAttribute("title")).toBe("users.labels.editTooltip");
    expect(remove.getAttribute("title")).toBe("users.labels.deleteTooltip");
  });
});

describe("user labels: edit dialog color", () => {
  it("keeps the current color in the picker when the Color field is emptied, as the warning says", async () => {
    render(<UserLabels username="bob@example.com" />);
    fireEvent.click(screen.getByText("users.labels.title"));
    fireEvent.click(await screen.findByTitle("users.labels.editTooltip"));

    fireEvent.change(await screen.findByLabelText("users.labels.colorLabel"), { target: { value: "" } });

    expect((screen.getByLabelText("users.labels.colorPicker") as HTMLInputElement).value).toBe("#ff0000");
    expect(screen.getByText(`users.labels.colorCannotBeCleared ${JSON.stringify({ color: "#ff0000" })}`)).not.toBeNull();
  });
});

describe("user labels: create modal", () => {
  it("opens the section and a modal from the +, and creates the typed label", async () => {
    render(<UserLabels username="bob@example.com" />);
    fireEvent.click(screen.getByTitle("users.labels.createButton"));

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText("users.labels.title").closest("button")?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("users.labels.displayNameLabel"), { target: { value: " Work " } });
    fireEvent.change(screen.getByLabelText("users.labels.description"), { target: { value: "Work emails" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() =>
      expect(createUserLabel).toHaveBeenCalledWith("bob@example.com", { displayName: "Work", description: "Work emails" })
    );
    await waitFor(() => expect(dialog.isConnected).toBe(false));
  });
});

// jsdom does not submit a form on Enter: submitting the field's form is what the browser does then
describe("user labels: Enter in a field", () => {
  it("creates the label, like Create", async () => {
    render(<UserLabels username="bob@example.com" />);
    fireEvent.click(screen.getByTitle("users.labels.createButton"));

    const displayName = (await screen.findByLabelText("users.labels.displayNameLabel")) as HTMLInputElement;
    fireEvent.change(displayName, { target: { value: "QAEnter" } });
    fireEvent.submit(displayName.form!);

    await waitFor(() => expect(createUserLabel).toHaveBeenCalledWith("bob@example.com", { displayName: "QAEnter" }));
  });

  it("saves the edited label, like Save", async () => {
    render(<UserLabels username="bob@example.com" />);
    fireEvent.click(screen.getByText("users.labels.title"));
    fireEvent.click(await screen.findByTitle("users.labels.editTooltip"));

    const displayName = (await screen.findByLabelText("users.labels.displayNameLabel")) as HTMLInputElement;
    fireEvent.submit(displayName.form!);

    await waitFor(() => expect(updateUserLabel).toHaveBeenCalledWith("bob@example.com", "1", expect.anything()));
  });
});
