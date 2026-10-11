// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("../api-client", () => ({
  getUserLabels: async () => [
    { id: "1", displayName: "Work", keyword: "$work", color: "#ff0000", description: "Job", readOnly: false },
  ],
  createUserLabel: vi.fn(),
  updateUserLabel: vi.fn(),
  deleteUserLabel: vi.fn(),
}));

import UserLabels from "./user-labels";

function openSection() {
  render(<UserLabels username="bob@example.com" />);
  fireEvent.click(screen.getByText("users.labels.title"));
}

afterEach(cleanup);

describe("user labels: field labels", () => {
  it.each([
    ["users.labels.displayNameLabel", "text"],
    ["users.labels.keyword", "text"],
    ["users.labels.color", "text"],
    ["users.labels.colorPicker", "color"],
    ["users.labels.description", "text"],
  ])("names the %s field of the create form", (label, type) => {
    openSection();
    fireEvent.click(screen.getByTitle("users.labels.createButton"));

    expect(screen.getByLabelText(label).getAttribute("type")).toBe(type);
  });

  it.each([
    ["users.labels.displayNameLabel", "text"],
    ["users.labels.colorLabel", "text"],
    ["users.labels.colorPicker", "color"],
    ["users.labels.descriptionLabel", "text"],
  ])("names the %s field of the edit dialog", async (label, type) => {
    openSection();
    fireEvent.click(await screen.findByTitle("users.labels.editTooltip"));

    expect((await screen.findByLabelText(label)).getAttribute("type")).toBe(type);
  });
});
