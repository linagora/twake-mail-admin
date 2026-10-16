// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError, AxiosHeaders } from "axios";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
vi.mock("@/lib/apiClient", () => ({ apiClient: api }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { message?: string }) => (options?.message ? `${key} ${options.message}` : key),
  }),
}));

import ExploreUserQuota from "./explore-user-quota";

const renderOpened = () => {
  render(
    <MemoryRouter>
      <ExploreUserQuota domain="example.com" />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText("exploreQuota.title"));
};

const minInput = () => screen.getByLabelText("exploreQuota.minOccupation") as HTMLInputElement;
const maxInput = () => screen.getByLabelText("exploreQuota.maxOccupation") as HTMLInputElement;

const search = (min: string, max: string) => {
  fireEvent.change(minInput(), { target: { value: min } });
  fireEvent.change(maxInput(), { target: { value: max } });
  fireEvent.click(screen.getByText("common.search"));
};

const webAdminError = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 400, type: "InvalidArgument", message },
  });

beforeEach(() => {
  api.get.mockReset();
});

afterEach(cleanup);

describe("explore user quota: field labels", () => {
  it.each(["exploreQuota.minOccupation", "exploreQuota.maxOccupation"])("names the %s field after its visible label", (label) => {
    renderOpened();

    expect(screen.getByLabelText(label)).toHaveProperty("type", "number");
  });
});

describe("explore user quota: occupation range", () => {
  it.each([
    { min: "-5", max: "100", invalid: minInput },
    { min: "", max: "100", invalid: minInput },
    { min: "0", max: "150", invalid: maxInput },
    { min: "0", max: "abc", invalid: maxInput },
  ])("flags a percentage outside 0-100 without searching: %o", ({ min, max, invalid }) => {
    renderOpened();

    search(min, max);

    expect(invalid().getAttribute("aria-invalid")).toBe("true");
    expect(invalid().getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("exploreQuota.invalidPercent");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("flags a min occupation above the max occupation without searching", () => {
    renderOpened();

    search("90", "10");

    expect(maxInput().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("exploreQuota.minAboveMax");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("sends the range as ratios once it is valid", async () => {
    api.get.mockResolvedValue([]);
    renderOpened();
    search("90", "10");

    search("10", "90");

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      "/quota/users?minOccupationRatio=0.1&maxOccupationRatio=0.9&limit=50&offset=0&domain=example.com"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(minInput().getAttribute("aria-invalid")).toBe("false");
    expect(maxInput().getAttribute("aria-invalid")).toBe("false");
  });
});

describe("explore user quota: search failure", () => {
  it("shows the WebAdmin message instead of the generic Axios message", async () => {
    api.get.mockRejectedValue(webAdminError("minOccupationRatio can not be negative"));
    renderOpened();

    search("10", "90");

    expect(await screen.findByText("common.errorPrefix minOccupationRatio can not be negative")).toBeTruthy();
  });

  it("does not keep the empty result text of a previous search", async () => {
    api.get.mockResolvedValueOnce([]).mockRejectedValueOnce(webAdminError("boom"));
    renderOpened();
    search("10", "90");
    await screen.findByText("exploreQuota.empty");

    search("20", "90");

    await screen.findByText("common.errorPrefix boom");
    expect(screen.queryByText("exploreQuota.empty")).toBeNull();
  });
});
