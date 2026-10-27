import axios from "axios";

/** The Twake space (from ldap-rest) a team mailbox belongs to. */
export interface TwakeSpaceBinding {
  organizationId: string;
  spaceId: string;
}

/** The space read from the annotations of a team mailbox: `deletedAt` is set once the space was deleted. */
export interface TwakeSpace extends TwakeSpaceBinding {
  deletedAt: string | null;
}

/** Which spaces a sync covers: a blank field widens it, both blank sync every space of every organization. */
export type SpaceSyncScope = TwakeSpaceBinding;

export const EVERY_SPACE: SpaceSyncScope = { organizationId: "", spaceId: "" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSpaceId = (value: string): boolean => UUID.test(value.trim());

const trimmed = ({ organizationId, spaceId }: TwakeSpaceBinding): TwakeSpaceBinding => ({
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

/** Mirrors the 400 of a binding: both IDs are required, the space ID is a UUID. */
export const bindingProblem = (binding: TwakeSpaceBinding): string | null => {
  const { organizationId, spaceId } = trimmed(binding);
  if (!organizationId) return "twakeSpace.organizationRequired";
  if (!spaceId) return "twakeSpace.spaceRequired";
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

export const teamMailboxSpacePath = (domain: string, mailbox: string): string =>
  `/domains/${encodeURIComponent(domain)}/team-mailboxes/${encodeURIComponent(mailbox)}/space`;

export const bindingBody = (binding: TwakeSpaceBinding): TwakeSpaceBinding => trimmed(binding);

export const bindSpaceCommand = (domain: string, mailbox: string, binding: TwakeSpaceBinding): string =>
  `curl -XPUT ${teamMailboxSpacePath(domain, mailbox)} -d '${JSON.stringify(bindingBody(binding))}'`;

/** Replaces a refusal of the given status with a message saying what it means here. */
export const explainStatus = (status: number, message: string) => (error: unknown): never => {
  if (axios.isAxiosError(error) && error.response?.status === status) throw new Error(message);
  throw error;
};
