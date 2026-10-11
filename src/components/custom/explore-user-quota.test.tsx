// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
vi.mock("@/lib/apiClient", () => ({ apiClient: { get: vi.fn() } }));

import ExploreUserQuota from "./explore-user-quota";

afterEach(cleanup);

describe("explore user quota: field labels", () => {
  it("names the occupation fields after their visible labels", () => {
    render(<ExploreUserQuota />);
    fireEvent.click(screen.getByText("exploreQuota.title"));

    expect((screen.getByLabelText("exploreQuota.minOccupation") as HTMLInputElement).value).toBe("80");
    expect((screen.getByLabelText("exploreQuota.maxOccupation") as HTMLInputElement).value).toBe("100");
  });
});
