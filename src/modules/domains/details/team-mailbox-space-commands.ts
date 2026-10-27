import { datetimeLocalToIso } from "@/lib/datetime-local";
import { TeamMailboxSpaceBinding } from "../types";

// The values typed in the "Bind to a space" dialog, and the request and command preview built from them.

export interface SpaceBindingValues {
  organizationId: string;
  spaceId: string;
  deleted: boolean;
  // Value of the datetime-local field: a wall-clock time of the browser time zone
  deletedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value.trim());

// The local time typed, as the UTC instant WebAdmin expects, e.g. 2026-10-01T08:00:00Z; "" when invalid
export const toUtcInstant = (localValue: string): string =>
  datetimeLocalToIso(localValue).replace(/\.000Z$/, "Z");

export const toSpaceBinding = (values: SpaceBindingValues): TeamMailboxSpaceBinding => ({
  organizationId: values.organizationId.trim(),
  spaceId: values.spaceId.trim(),
  ...(values.deleted ? { deletedAt: toUtcInstant(values.deletedAt) } : {}),
});

export const bindSpaceCommand = (domain: string, mailbox: string, binding: TeamMailboxSpaceBinding) =>
  `curl -XPUT /domains/${domain}/team-mailboxes/${mailbox}/space -H "Content-Type: application/json" -d '${JSON.stringify(binding)}'`;
