import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ReIndexMode, TaskKey, TaskProps } from "./types";
import { reloadCertificates } from "./api-client";
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
];

const headerSubTitle = "Common tasks for data maintenance of a Twake Mail server";

const docuUrl = "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_task_management";

export default function CommonTasks() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadPort, setReloadPort] = useState("");

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
      </div>
    </div>
  );
}
