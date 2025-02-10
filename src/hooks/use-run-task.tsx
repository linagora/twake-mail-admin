import { runBlobGarbageCollectionTask, runCleanupJmapUploadsTask, runFixMappingTask, runMailBoxesTask, runMessageTask, runQuotaTask } from "@/modules/common-tasks/api-client";
import { ReIndexMode, Task, TaskKey } from "@/modules/common-tasks/types";

export function useRunTask() {
  const runTask = async (taskKey: TaskKey, mode?: ReIndexMode) => {
    let data;
    switch (taskKey) {
      case TaskKey.REINDEX: {
        if (mode === ReIndexMode.FIX_OUTDATED) {
          data = await runMailBoxesTask({
            task: Task.REINDEX,
            mode: ReIndexMode.FIX_OUTDATED,
          });
        } else if (mode === ReIndexMode.REBUILD_ALL) {
          data = await runMailBoxesTask({
            task: Task.REINDEX,
            mode: ReIndexMode.REBUILD_ALL,
          });
        }
        break;
      }
      case TaskKey.FIX_MAILBOX_INCONSISTENCIES:
        data = await runMailBoxesTask({
          task: Task.SOLVE_INCONSISTENCIES,
        }, {
          headers: {
            'I-KNOW-WHAT-I-M-DOING': 'ALL-SERVICES-ARE-OFFLINE',
          },
        });
        break;
      case TaskKey.FIX_MESSAGE_INCONSISTENCIES:
        data = await runMessageTask({
          task: Task.SOLVE_INCONSISTENCIES,
        });
        break;
      case TaskKey.RECOMPUTE_MAILBOX_COUNTERS:
        data = await runMailBoxesTask({
          task: Task.RECOMPUTE_MAILBOX_COUNTERS,
        });
        break;
      case TaskKey.RECOMPUTE_MAILBOX_QUOTA:
        data = await runQuotaTask({
          task: Task.RECOMPUTE_CURRENT_QUOTAS,
        });
        break;
      case TaskKey.FIX_MAPPING_DENORMALIZATION:
        data = await runFixMappingTask();
        break;
      case TaskKey.CLEANUP_JMAP_UPLOADS:
        data = await runCleanupJmapUploadsTask();
        break;
      case TaskKey.BLOB_GARBAGE_COLLECTION:
        data = await runBlobGarbageCollectionTask();
        break;
      default:
        break;
    }

    return data.taskId;
  }

  return runTask;
}
