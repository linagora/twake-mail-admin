// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({
  getUsersWithSpecificQuotas: vi.fn(),
  getQuotaExtraSummary: vi.fn(),
}));

vi.mock("./api-client", () => api);

import UsersWithSpecificQuotas from "./users-with-specific-quotas";
import AggregatedExtraQuotas from "./aggregated-extra-quotas";

const format = (value: number | null) => String(value);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

afterEach(cleanup);

describe("users with specific quotas", () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <UsersWithSpecificQuotas formatCount={format} formatSize={format} />
      </MemoryRouter>
    );

  it("fetches the report only once opened", async () => {
    api.getUsersWithSpecificQuotas.mockResolvedValue([{ user: "bob@domain.tld", storageLimit: 42, countLimit: 7 }]);
    renderSection();

    expect(api.getUsersWithSpecificQuotas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "globalQuota.usersSpecific" }));

    expect(await screen.findByText("bob@domain.tld")).not.toBeNull();
    expect(api.getUsersWithSpecificQuotas).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "globalQuota.usersSpecificTitle" })).not.toBeNull();
  });

  it("shows the failure instead of the list", async () => {
    api.getUsersWithSpecificQuotas.mockRejectedValue(new Error("boom"));
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "globalQuota.usersSpecific" }));

    expect(await screen.findByText("common.errorPrefix")).not.toBeNull();
  });
});

describe("aggregated extra quotas", () => {
  it("fetches the summary only once opened", async () => {
    api.getQuotaExtraSummary.mockResolvedValue({
      totalExtraStorageLimit: 1024,
      totalExtraCountLimit: 10,
      totalUnlimitedStorage: 3,
      totalUnlimitedCount: 4,
    });
    render(<AggregatedExtraQuotas formatCount={format} formatSize={format} />);

    expect(api.getQuotaExtraSummary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "globalQuota.aggregatedExtra" }));

    expect(await screen.findByText("1024")).not.toBeNull();
    expect(screen.queryByText("3")).not.toBeNull();
    expect(api.getQuotaExtraSummary).toHaveBeenCalledTimes(1);
  });
});
