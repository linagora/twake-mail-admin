export enum ReIndexMode {
  REBUILD_ALL = 'rebuildAll',
  FIX_OUTDATED = 'fixOutdated',
};

export enum Task {
  REINDEX = 'reIndex',
  SOLVE_INCONSISTENCIES = 'SolveInconsistencies',
  RECOMPUTE_MAILBOX_COUNTERS = 'RecomputeMailboxCounters',
  RECOMPUTE_CURRENT_QUOTAS = 'RecomputeCurrentQuotas',
};

export enum TaskKey {
  REINDEX_FIXING_OUTDATE_MODE,
  REINDEX_ALL_MODE,
  FIX_MAILBOX_INCONSISTENCIES,
  FIX_MESSAGE_INCONSISTENCIES,
  RECOMPUTE_MAILBOX_COUNTERS,
  RECOMPUTE_MAILBOX_QUOTA,
  FIX_MAPPING_DENORMALIZATION,
  CLEANUP_JMAP_UPLOADS,
  BLOB_GARBAGE_COLLECTION,
};

export type TaskRequest = {
  task: Task.REINDEX | Task.SOLVE_INCONSISTENCIES | Task.RECOMPUTE_MAILBOX_COUNTERS | Task.RECOMPUTE_CURRENT_QUOTAS;
  mode?: ReIndexMode.REBUILD_ALL | ReIndexMode.FIX_OUTDATED;
};

export type TaskProps = {
  name: string;
  taskKey: TaskKey;
  command: string;
  doc: string;
}
