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
};

export type TaskRequest = {
  task: Task.REINDEX | Task.SOLVE_INCONSISTENCIES | Task.RECOMPUTE_MAILBOX_COUNTERS | Task.RECOMPUTE_CURRENT_QUOTAS | Task.CONTACT_INDEXING;
  mode?: ReIndexMode.REBUILD_ALL | ReIndexMode.FIX_OUTDATED;
};

export type AdditionalParams = {
  messagesPerSecond?: string;
  trustMessageProjection?: boolean;
  usersPerSecond?: string;
  quotaComponent?: string;
  associatedProbability?: string;
  expectedBlobCount?: string;
}

export type TaskProps = {
  name: string;
  taskKey: TaskKey;
  mode?: ReIndexMode;
  command: string;
  doc: string;
  params?: TaskParam[]
}

export enum TaskStatus {
  COMPLETED = 'completed',
  WAITING = 'waiting',
  IN_PROGRESS = 'inProgress',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
};

export type TaskDetailResponse = {
  submitDate: string;
  startedDate: string;
  completedDate: string;
  cancelledDate?: string;
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
  type: "input" | "checkbox" | "select";
  values?: string[];
}

export interface CommonTask {
  name: string;
  taskKey: string;
  command: string;
  params?: TaskParam[];
  doc?: string;
}