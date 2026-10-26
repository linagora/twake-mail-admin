// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  api: {
    getAllowedFromHeaders: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("../api-client", () => mocks.api);

import UserAllowedFrom from "./user-allowed-from";

const LONG_ADDRESS = "a.very.long.qa.address.for.the.bar@example.com";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getAllowedFromHeaders.mockResolvedValue([LONG_ADDRESS]);
});

afterEach(cleanup);

describe("user allowed from headers: a long address fits a phone screen", () => {
  it("lets a header row break inside the address", async () => {
    render(<UserAllowedFrom username={LONG_ADDRESS} />);
    fireEvent.click(screen.getByText("users.allowedFrom.title"));

    const row = (await screen.findByText(LONG_ADDRESS)).closest("h4");
    expect(row?.className).toContain("[overflow-wrap:anywhere]");
  });
});
