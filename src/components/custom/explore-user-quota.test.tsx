// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError, AxiosHeaders } from "axios";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
vi.mock("@/lib/apiClient", () => ({ apiClient: api }));
// The keys as text; the labelled key wraps its label, to tell it from the header
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { message?: string; label?: string }) => {
      if (key === "exploreQuota.labelled") return `labelled(${options?.label})`;
      return options?.message ? `${key} ${options.message}` : key;
    },
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

// The quota report, then the team mailboxes of each domain it lists
const answer = (report: unknown[], teamMailboxes: Record<string, unknown[]> = {}) =>
  api.get.mockImplementation((url: string) => {
    const domain = url.match(/^\/domains\/([^/]+)\/team-mailboxes$/)?.[1];
    if (domain === undefined) return Promise.resolve(report);
    const mailboxes = teamMailboxes[decodeURIComponent(domain)];
    return mailboxes ? Promise.resolve(mailboxes) : Promise.reject(new Error("forbidden"));
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

describe("explore user quota: stale results", () => {
  it("clears the previous results when the new range is invalid", async () => {
    api.get.mockResolvedValue([]);
    renderOpened();
    search("10", "90");
    await screen.findByText("exploreQuota.empty");

    search("90", "10");

    expect(screen.getByRole("alert").textContent).toBe("exploreQuota.minAboveMax");
    expect(screen.queryByText("exploreQuota.empty")).toBeNull();
  });
});

describe("explore user quota: keyboard", () => {
  it("runs the search when the form is submitted with Enter", async () => {
    api.get.mockResolvedValue([]);
    renderOpened();
    fireEvent.change(minInput(), { target: { value: "0" } });
    fireEvent.change(maxInput(), { target: { value: "100" } });

    fireEvent.submit(maxInput().form!);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      "/quota/users?minOccupationRatio=0&maxOccupationRatio=1&limit=50&offset=0&domain=example.com"));
  });
});

describe("explore user quota: phone layout", () => {
  const entry = {
    username: "alice@example.com",
    detail: {
      global: { count: null, size: null },
      domain: { count: null, size: null },
      user: { count: null, size: null },
      computed: { count: 1000, size: 52428800 },
      occupation: { size: 1126, count: 2, ratio: { size: 0.0001, count: 0.002, max: 0.002 } },
    },
  };
  const gridColumns = (element: HTMLElement) =>
    element.className.split(" ").filter((name) => name.includes("grid-cols-"));

  const searchOneUser = async () => {
    answer([entry]);
    renderOpened();
    search("0", "100");
    return screen.findByTestId("explore-quota-row");
  };

  it("gives the username a shrinkable column instead of fixed columns before it", async () => {
    const row = await searchOneUser();

    expect(gridColumns(row)).toContain("grid-cols-[2rem_minmax(0,1fr)]");
    expect(within(row).getByText("alice@example.com").className).toContain("min-w-0");
  });

  it("only shows the header from the sm breakpoint, with the same columns as the rows", async () => {
    const row = await searchOneUser();
    const header = screen.getByTestId("explore-quota-header");

    expect(header.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "sm:grid"]));
    expect(gridColumns(header)).toEqual(gridColumns(row));
  });

  it.each(["exploreQuota.occupationSize", "exploreQuota.occupationCount", "exploreQuota.ratioMax", "exploreQuota.computedLimit"])(
    "labels the %s figure of a row below the sm breakpoint",
    async (label) => {
      const row = await searchOneUser();

      expect(within(row).getByText(`labelled(${label})`).className.split(" ")).toContain("sm:hidden");
    });
});

describe("explore user quota: team mailboxes", () => {
  const entryOf = (username: string) => ({
    username,
    detail: {
      global: { count: null, size: null },
      domain: { count: null, size: null },
      user: { count: null, size: null },
      computed: { count: null, size: null },
      occupation: { size: 0, count: 0, ratio: { size: 0, count: 0, max: 0 } },
    },
  });

  const searchAll = () => {
    renderOpened();
    search("0", "100");
  };

  it("links a team mailbox to its page and tells it from the users", async () => {
    answer([entryOf("alice@example.com"), entryOf("sales@example.com")], {
      "example.com": [{ name: "sales", emailAddress: "sales@example.com" }],
    });
    searchAll();

    const teamMailbox = await screen.findByRole("link", { name: "sales@example.com" });

    expect(teamMailbox.getAttribute("href")).toBe("/domains/domain/example.com/team-mailbox/sales");
    expect(within(teamMailbox.parentElement!).getByText("exploreQuota.teamMailbox")).toBeTruthy();
    expect(screen.getByRole("link", { name: "alice@example.com" }).getAttribute("href")).toBe("/users/user/alice%40example.com");
    expect(screen.getAllByText("exploreQuota.teamMailbox")).toHaveLength(1);
  });

  it("reads the team mailboxes of each listed domain once", async () => {
    answer([entryOf("alice@example.com"), entryOf("bob@example.com"), entryOf("carol@other.org")], {
      "example.com": [],
      "other.org": [],
    });
    searchAll();

    await screen.findByRole("link", { name: "carol@other.org" });

    const teamMailboxCalls = api.get.mock.calls.map(([url]) => url).filter((url: string) => url.endsWith("/team-mailboxes"));
    expect(teamMailboxCalls.sort()).toEqual(["/domains/example.com/team-mailboxes", "/domains/other.org/team-mailboxes"]);
  });

  it("keeps the user links when the team mailboxes of a domain cannot be read", async () => {
    answer([entryOf("sales@example.com")]);
    searchAll();

    const link = await screen.findByRole("link", { name: "sales@example.com" });

    expect(link.getAttribute("href")).toBe("/users/user/sales%40example.com");
    expect(screen.queryByText("common.errorPrefix", { exact: false })).toBeNull();
  });
});
