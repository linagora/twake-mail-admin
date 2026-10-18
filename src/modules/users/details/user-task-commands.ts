import { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { RestoreCriterion, RestoreDeletedMessagesRequest } from "../types";

// Previews of the WebAdmin calls run by the user tasks, shown in their confirmation dialogs.
// They mirror the query parameters actually sent by the api-client: empty values are dropped,
// and a `true` flag is rendered as a bare parameter (e.g. `&force`).
type QueryValue = string | boolean | undefined;

const isSent = ([, value]: [string, QueryValue]) => value !== undefined && value !== false && value !== "";

export const withQuery = (path: string, params: [string, QueryValue][]): string => {
  const query = params
    .filter(isSent)
    .map(([key, value]) => (value === true ? key : `${key}=${value}`))
    .join("&");
  return query ? `${path}?${query}` : path;
};

export const orPlaceholder = (value: string, placeholder: string) => value.trim() || `{${placeholder}}`;

export const subscribeAllCommand = (username: string) =>
  `curl -XPOST /users/${username}/mailboxes?task=subscribeAll`;

export const deleteAllMailboxesCommand = (username: string) =>
  `curl -XDELETE /users/${username}/mailboxes`;

export const provisionTemplatesCommand = (username: string, values: ProvisionTemplatesValues) =>
  `curl -XPOST ${withQuery(`/users/${username}/templates`, [
    ["action", "provision"],
    ["from", orPlaceholder(values.sourceUser, "sourceUser")],
    ["folderName", values.folderName.trim()],
    ["overwriteExisting", values.overwriteExisting && "true"],
    ["prune", values.prune && "true"],
  ])}`;

export interface RenameUserValues {
  newUsername: string;
  force: boolean;
  fromStep: string;
}

export const renameUserCommand = (username: string, values: RenameUserValues) =>
  `curl -XPOST ${withQuery(`/users/${username}/rename/${orPlaceholder(values.newUsername, "newUser")}`, [
    ["action", "rename"],
    ["force", values.force],
    ["fromStep", values.fromStep],
  ])}`;

export const deleteUserDataCommand = (username: string, fromStep: string) =>
  `curl -XPOST ${withQuery(`/users/${username}`, [
    ["action", "deleteData"],
    ["fromStep", fromStep],
  ])}`;

export const buildRestoreRequest = (criteria: RestoreCriterion[], limit: number | undefined): RestoreDeletedMessagesRequest => ({
  combinator: "and",
  criteria,
  ...(limit === undefined ? {} : { limit }),
});

export const restoreDeletedMessagesCommand = (username: string, request: RestoreDeletedMessagesRequest) =>
  `curl -XPOST /deletedMessages/users/${username}?action=restore -d '${JSON.stringify(request)}'`;
