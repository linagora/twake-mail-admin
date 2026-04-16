import {
  runBlobGarbageCollectionTask,
  runCleanupJmapUploadsTask,
  runFixMappingTask,
  runMailBoxesTask,
  runMessageTask,
  runPurgeDeletedMessagesTask,
  runQuotaTask,
  runImportLdapUsersTask,
  runDomainMemberSyncTask,
  runCalendarEventReindexTask,
  runCalendarEventArchivalTask,
  runAlarmReschedulingTask,
  runAddMissingFieldsTask,
} from "@/modules/common-tasks/api-client";
import { AdditionalParams, ReIndexMode, Task, TaskKey } from "@/modules/common-tasks/types";

export function useRunTask() {
  const runTask = async (taskKey: TaskKey, mode?: ReIndexMode, taskParamValues?: AdditionalParams) => {
    let data;
    switch (taskKey) {
      case TaskKey.REINDEX: {
        if (mode === ReIndexMode.FIX_OUTDATED) {
          data = await runMailBoxesTask({
            task: Task.REINDEX,
            mode: ReIndexMode.FIX_OUTDATED,
            ...taskParamValues,
          });
        } else if (mode === ReIndexMode.REBUILD_ALL) {
          data = await runMailBoxesTask({
            task: Task.REINDEX,
            mode: ReIndexMode.REBUILD_ALL,
            ...taskParamValues
          });
        }
        break;
      }
      case TaskKey.FIX_MAILBOX_INCONSISTENCIES:
        data = await runMailBoxesTask({
          task: Task.SOLVE_INCONSISTENCIES,
          ...taskParamValues
        }, {
          headers: {
            'I-KNOW-WHAT-I-M-DOING': 'ALL-SERVICES-ARE-OFFLINE',
          },
        });
        break;
      case TaskKey.FIX_MESSAGE_INCONSISTENCIES:
        data = await runMessageTask({
          task: Task.SOLVE_INCONSISTENCIES,
          ...taskParamValues,
        });
        break;
      case TaskKey.RECOMPUTE_MAILBOX_COUNTERS:
        data = await runMailBoxesTask({
          task: Task.RECOMPUTE_MAILBOX_COUNTERS,
          ...taskParamValues,
        });
        break;
      case TaskKey.RECOMPUTE_MAILBOX_QUOTA:
        data = await runQuotaTask({
          task: Task.RECOMPUTE_CURRENT_QUOTAS,
          ...taskParamValues
        });
        break;
      case TaskKey.FIX_MAPPING_DENORMALIZATION:
        data = await runFixMappingTask(taskParamValues);
        break;
      case TaskKey.CLEANUP_JMAP_UPLOADS:
        data = await runCleanupJmapUploadsTask(taskParamValues);
        break;
      case TaskKey.BLOB_GARBAGE_COLLECTION:
        data = await runBlobGarbageCollectionTask(taskParamValues);
        break;
      case TaskKey.CONTACT_INDEXING:
        data = await runMailBoxesTask({
          task: Task.CONTACT_INDEXING,
          ...taskParamValues,
        });
        break;
      case TaskKey.PURGE_DELETED_MESSAGES:
        data = await runPurgeDeletedMessagesTask();
        break;
      case TaskKey.IMPORT_LDAP_USERS:
        data = await runImportLdapUsersTask(taskParamValues);
        break;
      case TaskKey.DOMAIN_MEMBER_SYNC:
        data = await runDomainMemberSyncTask(taskParamValues);
        break;
      case TaskKey.ADD_MISSING_FIELDS:
        data = await runAddMissingFieldsTask();
        break;
      case TaskKey.CALENDAR_EVENT_REINDEX:
        data = await runCalendarEventReindexTask(taskParamValues);
        break;
      case TaskKey.CALENDAR_EVENT_ARCHIVAL:
        data = await runCalendarEventArchivalTask(taskParamValues);
        break;
      case TaskKey.ALARM_RESCHEDULING:
        data = await runAlarmReschedulingTask(taskParamValues);
        break;
      default:
        break;
    }

    return data.taskId;
  }

  return runTask;
}
