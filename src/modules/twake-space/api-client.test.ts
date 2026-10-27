import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({ apiClient: http }));

import { requestSpacesSync } from "./api-client";

const SPACE = "11111111-1111-1111-1111-111111111111";

beforeEach(() => vi.resetAllMocks());

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
