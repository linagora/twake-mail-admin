/**
 * Plain-language description of the WebAdmin task parameters, by query key. Every task
 * dialog of both applications renders its parameters through TaskParamsModifier, which
 * reads this table: a parameter is labelled the same way wherever it appears. The raw key
 * stays visible next to the label and in the command preview.
 *
 * Translations live under `commonTasks.params.<key>`: `label`, then `help`, `unit` and
 * `values.<value>` when flagged here.
 */
export interface ParamDescription {
  help?: boolean;
  unit?: boolean;
  // Options of a select, translated under `values.<value>`; true/false read Yes/No.
  values?: boolean;
  // Label of the empty option of a select: what the server does without the parameter.
  empty?: "any" | "all" | "serverDefault";
}

export const PARAM_DESCRIPTIONS: Record<string, ParamDescription> = {
  // Throttling
  messagesPerSecond: { help: true, unit: true },
  eventsPerSecond: { help: true },
  usersPerSecond: { help: true },
  contactsPerSecond: { help: true },
  // Mail repositories and dead letters
  queue: { help: true },
  processor: { help: true },
  consume: { help: true },
  limit: { help: true },
  maxRetries: { help: true, unit: true },
  // Cleanup and tiering
  olderThan: { help: true },
  tiering: { help: true },
  // Mail maintenance
  mode: { help: true, values: true, empty: "serverDefault" },
  maxIterations: { help: true },
  autoMerge: { help: true },
  trustMessageProjection: { help: true },
  quotaComponent: { values: true, empty: "all" },
  associatedProbability: { help: true },
  expectedBlobCount: { help: true },
  dryRun: { help: true },
  // User mailboxes reindexing: skips the check that the user exists
  force: { help: true },
  // Calendar and contacts
  createdBefore: { help: true },
  lastModifiedBefore: { help: true },
  masterDtStartBefore: { help: true },
  isRejected: { empty: "any" },
  isNotRecurring: { empty: "any" },
  ignoredDomains: { help: true },
  ldapFilter: { help: true },
  scope: { values: true, empty: "all" },
};

export const paramLabelKey = (key: string) => `commonTasks.params.${key}.label`;
export const paramHelpKey = (key: string) => `commonTasks.params.${key}.help`;
export const paramUnitKey = (key: string) => `commonTasks.params.${key}.unit`;
export const paramValueKey = (key: string, value: string) =>
  value === "true" ? "common.yes" : value === "false" ? "common.no" : `commonTasks.params.${key}.values.${value}`;
export const paramEmptyKey = (empty: NonNullable<ParamDescription["empty"]>) => `commonTasks.params.empty.${empty}`;
