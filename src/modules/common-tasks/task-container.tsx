import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button";
import { ReIndexMode, Task, TaskKey, TaskProps } from "./types";
import { useState } from "react";
import { runBlobGarbageCollectionTask, runCleanupJmapUploadsTask, runFixMappingTask, runMailBoxesTask, runMessageTask, runQuotaTask } from "./api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TaskContainer({ name, taskKey, command, doc }: TaskProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShowAlert, setIsShowAlert] = useState<boolean>(false);

  const runTask = async () => {
    try {
      setIsLoading(true);
      switch (taskKey) {
        case TaskKey.REINDEX_FIXING_OUTDATE_MODE:
          await runMailBoxesTask({
            task: Task.REINDEX,
            mode: ReIndexMode.FIX_OUTDATED,
          });
          break;
        case TaskKey.REINDEX_ALL_MODE:
          await runMailBoxesTask({
            task: Task.REINDEX,
            mode: ReIndexMode.REBUILD_ALL,
          });
          break;
        case TaskKey.FIX_MAILBOX_INCONSISTENCIES:
          await runMailBoxesTask({
            task: Task.SOLVE_INCONSISTENCIES,
          }, {
            headers: {
              'I-KNOW-WHAT-I-M-DOING': 'ALL-SERVICES-ARE-OFFLINE',
            },
          });
          break;
        case TaskKey.FIX_MESSAGE_INCONSISTENCIES:
          await runMessageTask({
            task: Task.SOLVE_INCONSISTENCIES,
          });
          break;
        case TaskKey.RECOMPUTE_MAILBOX_COUNTERS:
          await runMailBoxesTask({
            task: Task.RECOMPUTE_MAILBOX_COUNTERS,
          });
          break;
        case TaskKey.RECOMPUTE_MAILBOX_QUOTA:
          await runQuotaTask({
            task: Task.RECOMPUTE_CURRENT_QUOTAS,
          });
          break;
        case TaskKey.FIX_MAPPING_DENORMALIZATION:
          await runFixMappingTask();
          break;
        case TaskKey.CLEANUP_JMAP_UPLOADS:
          await runCleanupJmapUploadsTask();
          break;
        case TaskKey.BLOB_GARBAGE_COLLECTION:
          await runBlobGarbageCollectionTask();
          break;
        default:
          break;
      }

      setIsShowAlert(true);
    } catch (error) {
      console.log(error)
    } finally {
      setIsLoading(false);
    }
  }

  const hideAlert = () => {
    setIsShowAlert(false);
  }

  return (
    <>
      <div className="flex justify-between items-center gap-4">
        <p>{name}</p>
        <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={runTask}>
          {isLoading && <Loader2 className="animate-spin" />}
          Run
        </Button>
      </div>
      {isShowAlert && (
        <Alert
          className="fixed bottom-[40px] left-[50%] translate-x-[-50%] w-[400px] shadow-md shadow-gray-400 border-none bg-green-500"
        >
          <AlertDescription className="flex items-center">
            <p>{command} <a className="text-blue-500 hover:underline" href={doc} target="_blank">(doc)</a></p>
            <Button className="hover:bg-transparent hover:text-gray-500" variant="ghost" size="icon" onClick={hideAlert}>
              <X />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
