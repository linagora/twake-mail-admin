import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({ apiClient: http }));

import { bindTeamMailboxSpace, getTeamMailboxSpace, requestSpacesSync } from "./api-client";

const SPACE = "11111111-1111-1111-1111-111111111111";

const refusal = (status: number) =>
  new AxiosError("Request failed", undefined, undefined, undefined, {
    status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: {},
  });

beforeEach(() => vi.resetAllMocks());

describe("space of a team mailbox", () => {
  it("reads the space of the team mailbox (200)", async () => {
    const space = { organizationId: "org-1", spaceId: SPACE, deletedAt: null };
    http.get.mockResolvedValue(space);

    expect(await getTeamMailboxSpace("domain.tld", "sales")).toEqual(space);
    expect(http.get).toHaveBeenCalledWith("/domains/domain.tld/team-mailboxes/sales/space");
  });

  it("reads a 404 as no space: unbound, or no Twake Space extension", async () => {
    http.get.mockRejectedValue(refusal(404));

    expect(await getTeamMailboxSpace("domain.tld", "sales")).toBeNull();
  });

  it("lets any other failure through (400)", async () => {
    const badRequest = refusal(400);
    http.get.mockRejectedValue(badRequest);

    await expect(getTeamMailboxSpace("domain.tld", "sales")).rejects.toBe(badRequest);
  });
});

describe("binding a team mailbox", () => {
  it("puts the trimmed IDs (204)", async () => {
    http.put.mockResolvedValue(undefined);

    await bindTeamMailboxSpace("domain.tld", "sales", { organizationId: " org-1 ", spaceId: SPACE });

    expect(http.put).toHaveBeenCalledWith("/domains/domain.tld/team-mailboxes/sales/space", { organizationId: "org-1", spaceId: SPACE });
  });
});

describe("sync of the spaces", () => {
  it("publishes a sync of every space (204)", async () => {
    http.post.mockResolvedValue(undefined);

    await requestSpacesSync({ organizationId: "", spaceId: "" });

    expect(http.post).toHaveBeenCalledWith("/spaces?action=sync");
  });

  it("restricts the sync to one space of an organization", async () => {
    http.post.mockResolvedValue(undefined);

    await requestSpacesSync({ organizationId: "org-1", spaceId: SPACE });

    expect(http.post).toHaveBeenCalledWith(`/spaces?action=sync&organizationId=org-1&spaceId=${SPACE}`);
  });
});
