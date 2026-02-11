import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ReIndexMode, TaskKey, TaskProps } from "./types";

import { reloadCertificates, cleanupOldTasks } from "./api-client";
import TaskContainer from "./task-container";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";

const TASKS: TaskProps[] = [
  {
    name: 'Reindex all data in OpenSearch (fix outdated mode)',
    taskKey: TaskKey.REINDEX,
    mode: ReIndexMode.FIX_OUTDATED,
    command: 'curl -XPOST /mailboxes?task=reIndex&mode=fixOutdated',
    params: [
      { key: 'messagesPerSecond', defaultValue: '50', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_reindexing_action',
  },
  {
    name: 'Reindex all data in OpenSearch (reindex all mode)',
    taskKey: TaskKey.REINDEX,
    mode: ReIndexMode.REBUILD_ALL,
    command: 'curl -XPOST /mailboxes?task=reIndex&mode=rebuildAll',
    params: [
      { key: 'messagesPerSecond', defaultValue: '50', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_reindexing_action',
  },
  {
    name: 'Fix mailbox inconsistencies',
    taskKey: TaskKey.FIX_MAILBOX_INCONSISTENCIES,
    command: 'curl -XPOST /mailboxes?task=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_fixing_mailboxes_inconsistencies',
  },
  {
    name: 'Fix message inconsistencies',
    taskKey: TaskKey.FIX_MESSAGE_INCONSISTENCIES,
    command: 'curl -XPOST /messages?task=SolveInconsistencies',
    params: [
      { key: 'messagesPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_fixing_message_inconsistencies_2',
  },
  {
    name: 'Recompute mailbox counters',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_COUNTERS,
    command: 'curl -XPOST /mailboxes?task=RecomputeMailboxCounters',
    params: [
      { key: 'trustMessageProjection', defaultValue: false, type: 'checkbox' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_recomputing_mailbox_counters',
  },
  {
    name: 'Recompute mailbox quota',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_QUOTA,
    command: 'curl -XPOST /quota/users?task=RecomputeCurrentQuotas',
    params: [
      { key: 'usersPerSecond', defaultValue: '1', type: 'input' },
      { key: 'quotaComponent', values: ['MAILBOX', 'SIEVE', 'JMAP_UPLOADS'], type: 'select' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_recomputing_current_quotas_for_users',
  },
  {
    name: 'Fix mapping denormalization',
    taskKey: TaskKey.FIX_MAPPING_DENORMALIZATION,
    command: 'curl -XPOST /cassandra/mappings?action=SolveInconsistenciescurl -XPOST /cassandra/mappings?action=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_operations_on_mappings_sources',
  },
  {
    name: 'Cleanup JMAP uploads',
    taskKey: TaskKey.CLEANUP_JMAP_UPLOADS,
    command: 'curl -XDELETE /jmap/uploads?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_cleaning_upload_repository',
  },
  {
    name: 'Blob garbage collection',
    taskKey: TaskKey.BLOB_GARBAGE_COLLECTION,
    command: 'curl -XDELETE /blobs?scope=unreferenced',
    params: [
      { key: 'associatedProbability', defaultValue: '0.01', type: 'input' },
      { key: 'expectedBlobCount', defaultValue: '1.000.000', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_running_blob_garbage_collection',
  },
  {
    name: 'Reindex contacts from sent mailbox',
    taskKey: TaskKey.CONTACT_INDEXING,
    command: 'curl -XPOST /mailboxes?task=ContactIndexing',
    params: [
      { key: 'usersPerSecond', defaultValue: '1', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_contact_indexing',
  },
];

const headerSubTitle = "Common tasks for data maintenance of a Twake Mail server";

const docuUrl = "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_task_management";

export default function CommonTasks() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadPort, setReloadPort] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("30");

  const handleReloadCertificates = async () => {
    const confirmed = await confirm({
      header: "Reload Certificates",
      message: `Reload server certificates${reloadPort ? ` for port ${reloadPort}` : " for all ports"}?`,
    });
    if (!confirmed) return;

    setReloadLoading(true);
    try {
      await reloadCertificates(reloadPort || undefined);
      toast({ title: "Certificates reloaded successfully" });
    } catch (err) {
      toast({
        title: "Error reloading certificates",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setReloadLoading(false);
    }
  };

  const handleCleanupOldTasks = async () => {
    const days = parseInt(cleanupDays);
    if (isNaN(days) || days <= 0) return;
    const confirmed = await confirm({
      header: "Cleanup Old Tasks",
      message: `Delete all tasks older than ${days} day${days > 1 ? "s" : ""}?`,
    });
    if (!confirmed) return;

    setCleanupLoading(true);
    try {
      await cleanupOldTasks(days);
      toast({ title: `Old tasks (>${days} days) cleaned up` });
    } catch (err) {
      toast({
        title: "Error cleaning up old tasks",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="p-4 relative w-fit">
      <Header
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
      />

      <div className="grid grid-cols-1 gap-4 mt-4">
        {TASKS.map((task) => (
          <TaskContainer {...task} key={task.name} />
        ))}
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <p>Reload certificates</p>
            <input
              type="text"
              placeholder="port (optional)"
              value={reloadPort}
              onChange={(e) => setReloadPort(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-32"
            />
          </div>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleReloadCertificates}>
                  {reloadLoading && <Loader2 className="animate-spin" />}
                  Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                curl -XPOST /servers?reload-certificate
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <p>Cleaning up old tasks</p>
            <input
              type="number"
              min="1"
              placeholder="days"
              value={cleanupDays}
              onChange={(e) => setCleanupDays(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-24"
            />
            <span className="text-sm text-gray-500">days</span>
          </div>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600 rounded-sm" onClick={handleCleanupOldTasks}>
                  {cleanupLoading && <Loader2 className="animate-spin" />}
                  Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                curl -XDELETE /tasks?olderThan=Nday
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
