// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("../api-client", () => ({
  getUserVacation: async () => ({ enabled: false }),
  updateUserVacation: vi.fn(),
  deleteUserVacation: vi.fn(),
}));

import UserVacation from "./user-vacation";

afterEach(cleanup);

describe("user vacation: field labels", () => {
  it.each([
    ["users.vacation.from", "INPUT"],
    ["users.vacation.to", "INPUT"],
    ["users.vacation.subject", "INPUT"],
    ["users.vacation.textBody", "TEXTAREA"],
    ["users.vacation.htmlBody", "TEXTAREA"],
  ])("names the %s field after its visible label", async (label, tagName) => {
    render(<UserVacation username="charlotte@example.com" />);
    fireEvent.click(screen.getByText("users.vacation.title"));

    expect((await screen.findByLabelText(label)).tagName).toBe(tagName);
  });
});
