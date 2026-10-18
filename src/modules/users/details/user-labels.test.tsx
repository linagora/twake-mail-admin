// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
