import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { explainStatus, isSpaceId, syncScopeProblem, syncSpacesCommand, syncSpacesQuery } from "./space";

const SPACE = "11111111-1111-1111-1111-111111111111";

const refusal = (status: number) =>
  new AxiosError("Request failed", undefined, undefined, undefined, {
    status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: {},
  });

describe("space ID", () => {
  it.each([SPACE, "ABCDEF01-2345-6789-abcd-ef0123456789", ` ${SPACE} `])("accepts the UUID %s", (value) => {
    expect(isSpaceId(value)).toBe(true);
  });

  it.each(["", "sales", "11111111-1111-1111-1111-11111111111", "11111111111111111111111111111111"])("refuses %s", (value) => {
    expect(isSpaceId(value)).toBe(false);
  });
});

describe("sync scope", () => {
  it("syncs every space when both fields are blank", () => {
    expect(syncScopeProblem({ organizationId: " ", spaceId: "" })).toBeNull();
    expect(syncSpacesQuery({ organizationId: " ", spaceId: "" })).toBe("action=sync");
  });

  it("restricts the sync to an organization, then to one of its spaces", () => {
    expect(syncSpacesQuery({ organizationId: " org-1 ", spaceId: "" })).toBe("action=sync&organizationId=org-1");
    expect(syncSpacesQuery({ organizationId: "org-1", spaceId: SPACE })).toBe(`action=sync&organizationId=org-1&spaceId=${SPACE}`);
  });

  it("mirrors the 400 of a space ID without its organization", () => {
    expect(syncScopeProblem({ organizationId: "", spaceId: SPACE })).toBe("twakeSpace.sync.spaceNeedsOrganization");
  });

  it("mirrors the 400 of a space ID that is not a UUID", () => {
    expect(syncScopeProblem({ organizationId: "org-1", spaceId: "sales" })).toBe("twakeSpace.invalidSpaceId");
  });

  it("previews the request with the fields that are sent", () => {
    expect(syncSpacesCommand({ organizationId: "org-1", spaceId: "" })).toBe('curl -XPOST "/spaces?action=sync&organizationId=org-1"');
  });
});

describe("explainStatus", () => {
  it("replaces a refusal of the given status with the explanation", () => {
    expect(() => explainStatus(409, "taken")(refusal(409))).toThrow("taken");
  });

  it("rethrows any other failure as it is", () => {
    const badRequest = refusal(400);
    expect(() => explainStatus(409, "taken")(badRequest)).toThrow(badRequest);
  });
});
