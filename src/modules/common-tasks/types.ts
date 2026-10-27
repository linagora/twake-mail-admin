export enum ReIndexMode {
  REBUILD_ALL = 'rebuildAll',
  FIX_OUTDATED = 'fixOutdated',
};

export enum Task {
  REINDEX = 'reIndex',
  SOLVE_INCONSISTENCIES = 'SolveInconsistencies',
  RECOMPUTE_MAILBOX_COUNTERS = 'RecomputeMailboxCounters',
  RECOMPUTE_CURRENT_QUOTAS = 'RecomputeCurrentQuotas',
  CONTACT_INDEXING = 'ContactIndexing',
};

export enum TaskKey {
  REINDEX = 'full-reindexing',
  FIX_MAILBOX_INCONSISTENCIES = 'solve-mailbox-inconsistencies',
  FIX_MESSAGE_INCONSISTENCIES = 'solve-message-inconsistencies',
  RECOMPUTE_MAILBOX_COUNTERS = 'recompute-mailbox-counters',
  RECOMPUTE_MAILBOX_QUOTA = 'recompute-current-quotas',
  FIX_MAPPING_DENORMALIZATION = 'cassandra-mappings-solve-inconsistencies',
  CLEANUP_JMAP_UPLOADS = 'UploadRepositoryCleanupTask',
  BLOB_GARBAGE_COLLECTION = 'BlobGCTask',
  CONTACT_INDEXING = 'ContactIndexing',
  PURGE_DELETED_MESSAGES = 'DeletedMessageVaultDeleteExpiredMessagesTask',
  POPULATE_EMAIL_QUERY_VIEW = 'PopulateEmailQueryViewTask',
  // Twake Space extension of TMail
  TWAKE_SPACE_PURGE = 'twake-space-purge',
  TWAKE_SPACE_REINDEX = 'twake-space-reindex',
  // Calendar-specific tasks
  IMPORT_LDAP_USERS = 'importFromLDAP',
  DOMAIN_MEMBER_SYNC = 'domainMemberSync',
  ADD_MISSING_FIELDS = 'addMissingFields',
  CALENDAR_EVENT_REINDEX = 'calendarEventReindex',
  ALARM_RESCHEDULING = 'alarmRescheduling',
  CALENDAR_EVENT_ARCHIVAL = 'calendarEventArchival',
  CLEAR_DOMAIN_MEMBERS_CONTACTS = 'clear-domain-members-contacts-dav',
  REPUBLISH_COMMON_CONTACTS = 'republish-common-contacts',
};

export type TaskRequest = {
  task: Task.REINDEX | Task.SOLVE_INCONSISTENCIES | Task.RECOMPUTE_MAILBOX_COUNTERS | Task.RECOMPUTE_CURRENT_QUOTAS | Task.CONTACT_INDEXING;
  mode?: ReIndexMode.REBUILD_ALL | ReIndexMode.FIX_OUTDATED;
};

export type AdditionalParams = {
  messagesPerSecond?: string;
  trustMessageProjection?: boolean;
  maxIterations?: string;
  autoMerge?: boolean;
  usersPerSecond?: string;
  quotaComponent?: string;
  associatedProbability?: string;
  expectedBlobCount?: string;
  // Calendar-specific params
  ignoredDomains?: string;
  ldapFilter?: string;
  eventsPerSecond?: string;
  createdBefore?: string;
  lastModifiedBefore?: string;
  masterDtStartBefore?: string;
  isRejected?: string;
  isNotRecurring?: string;
  contactsPerSecond?: string;
  scope?: string;
}

export type TaskProps = {
  nameKey: string;
  taskKey: TaskKey;
  mode?: ReIndexMode;
  command: string;
  doc: string;
  params?: TaskParam[];
  allowanceCheck?: { verb: import("@/lib/proxy-resolver").HttpVerb; pattern: string };
  risk?: import("@/components/custom/run-task-button").TaskRisk;
  // Irreversible task: what it deletes, and the word to type before it can run.
  consequenceKey?: string;
  // Heading of Common Tasks the task is listed under
  group?: TaskGroup;
  typeToConfirmKey?: string;
  // Optional backend extension: a 404 tells the operator it is not installed, not a raw error
  unavailableKey?: string;
}

export type TaskGroup = "search" | "consistency" | "cleanup" | "space" | "server" | "directory";

// One line saying when to use a task and what it costs, next to its name
export const taskDescriptionKey = (nameKey: string) => nameKey.replace(/^commonTasks\./, "commonTasks.desc.");

export enum TaskStatus {
  COMPLETED = 'completed',
  WAITING = 'waiting',
  IN_PROGRESS = 'inProgress',
  CANCEL_REQUESTED = 'canceledRequested',
  CANCELLED = 'canceled',
  FAILED = 'failed',
};

export type TaskDetailResponse = {
  submitDate: string;
  startedDate: string;
  completedDate: string;
  canceledDate?: string;
  failedDate?: string;
  taskId: string;
  additionalInformation: any;
  status: TaskStatus;
  type: TaskKey;
  executedOn: string;
  submittedFrom?: string;
  cancelledFrom?: string;
}

export type RunTaskResponse = {
  taskId: string;
}

export interface TaskParam {
  key: string;
  defaultValue?: string | boolean;
  type: "input" | "checkbox" | "select" | "duration";
  values?: string[];
  // Label and help are looked up by key in PARAM_DESCRIPTIONS (param-descriptions.ts);
  // these override them for a dialog where the parameter means something else.
  labelKey?: string;
  helpKey?: string;
  // Almost every WebAdmin task parameter has a server default: optional unless told
  // otherwise. A required one (optional: false) is labelled with "*".
  optional?: boolean;
  // Rarely needed: shown in a closed "Advanced options" section.
  advanced?: boolean;
}

export interface CommonTask {
  name: string;
  taskKey: string;
  command: string;
  params?: TaskParam[];
  doc?: string;
}