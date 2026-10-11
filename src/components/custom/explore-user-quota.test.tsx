// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
vi.mock("@/lib/apiClient", () => ({ apiClient: { get: vi.fn() } }));

import ExploreUserQuota from "./explore-user-quota";

afterEach(cleanup);

describe("explore user quota: field labels", () => {
  it.each(["exploreQuota.minOccupation", "exploreQuota.maxOccupation"])("names the %s field after its visible label", (label) => {
    render(
      <MemoryRouter>
        <ExploreUserQuota />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("exploreQuota.title"));

    expect(screen.getByLabelText(label)).toHaveProperty("type", "number");
  });
});
