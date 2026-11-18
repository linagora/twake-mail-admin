import { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { RestoreCriterion, RestoreDeletedMessagesRequest } from "../types";

// Previews of the WebAdmin calls run by the user tasks, shown in their confirmation dialogs.
// They mirror the query parameters actually sent by the api-client: empty values are dropped,
// a `true` flag is rendered as a bare parameter (e.g. `&force`), and the characters that would
// change the meaning of the query (`&`, `=`, `+`, `#`, `%`, spaces...) are percent-encoded.
type QueryValue = string | boolean | undefined;

type SentParam = [string, string | true];

const isSent = (param: [string, QueryValue]): param is SentParam => {
  const [, value] = param;
  return value !== undefined && value !== false && value !== "";
};

// Keeps readable what is valid as is in a query value (e.g. an email, a `{placeholder}`).
const UNSAFE_QUERY_CHARACTER = /[^A-Za-z0-9\-._~!$'()*,;:@/?{}]/gu;

export const encodeQueryValue = (value: string): string =>
  value.replace(UNSAFE_QUERY_CHARACTER, encodeURIComponent);

export const withQuery = (path: string, params: [string, QueryValue][]): string => {
  const query = params
    .filter(isSent)
    .map(([key, value]) => (value === true ? key : `${key}=${encodeQueryValue(value)}`))
    .join("&");
  return query ? `${path}?${query}` : path;
};

// The step a rename or a deletion resumes from: a blank value means "from the start".
export const resumeStep = (fromStep: string): string | undefined => fromStep.trim() || undefined;

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
    ["fromStep", resumeStep(values.fromStep)],
  ])}`;

export const deleteUserDataCommand = (username: string, fromStep: string) =>
  `curl -XPOST ${withQuery(`/users/${username}`, [
    ["action", "deleteData"],
    ["fromStep", resumeStep(fromStep)],
  ])}`;

export const buildRestoreRequest = (criteria: RestoreCriterion[], limit: number | undefined): RestoreDeletedMessagesRequest => ({
  combinator: "and",
  criteria,
  ...(limit === undefined ? {} : { limit }),
});

export const restoreDeletedMessagesCommand = (username: string, request: RestoreDeletedMessagesRequest) =>
  `curl -XPOST /deletedMessages/users/${username}?action=restore -d '${JSON.stringify(request)}'`;
