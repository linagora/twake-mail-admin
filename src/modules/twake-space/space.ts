import axios from "axios";

/** Which Twake spaces a sync covers: a blank field widens it, both blank sync every space of every organization. */
export interface SpaceSyncScope {
  organizationId: string;
  spaceId: string;
}

export const EVERY_SPACE: SpaceSyncScope = { organizationId: "", spaceId: "" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSpaceId = (value: string): boolean => UUID.test(value.trim());

const trimmed = ({ organizationId, spaceId }: SpaceSyncScope): SpaceSyncScope => ({
  organizationId: organizationId.trim(),
  spaceId: spaceId.trim(),
});

/** The i18n key of what the server would refuse with a 400, or null when the space ID is acceptable. */
const spaceIdProblem = (spaceId: string): string | null =>
  isSpaceId(spaceId) ? null : "twakeSpace.invalidSpaceId";

/** Mirrors the 400 of a sync: a space ID needs its organization, and is a UUID. */
export const syncScopeProblem = (scope: SpaceSyncScope): string | null => {
  const { organizationId, spaceId } = trimmed(scope);
  if (!spaceId) return null;
  if (!organizationId) return "twakeSpace.sync.spaceNeedsOrganization";
  return spaceIdProblem(spaceId);
};

/** The query of a sync, its blank fields left out. */
export const syncSpacesQuery = (scope: SpaceSyncScope): string => {
  const { organizationId, spaceId } = trimmed(scope);
  return new URLSearchParams({
    action: "sync",
    ...(organizationId && { organizationId }),
    ...(spaceId && { spaceId }),
  }).toString();
};

export const syncSpacesCommand = (scope: SpaceSyncScope): string =>
  `curl -XPOST "/spaces?${syncSpacesQuery(scope)}"`;

/** Replaces a refusal of the given status with a message saying what it means here. */
export const explainStatus = (status: number, message: string) => (error: unknown): never => {
  if (axios.isAxiosError(error) && error.response?.status === status) throw new Error(message);
  throw error;
};
