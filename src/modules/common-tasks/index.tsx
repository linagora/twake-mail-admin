import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { ReIndexMode, TaskKey, TaskProps } from "./types";

import { reloadCertificates, cleanupOldTasks, repositionTeamMailboxSystemRights, cleanupMailbox } from "./api-client";
import ConfirmTaskContent from "./components/confirm-task-content";
import { TaskParam } from "./types";
import TaskContainer from "./task-container";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { appConfig } from "@/lib/config";

const TASKS: TaskProps[] = [
  {
    name: 'Reindex all data in OpenSearch (fix outdated mode)',
    taskKey: TaskKey.REINDEX,
    mode: ReIndexMode.FIX_OUTDATED,
    command: 'curl -XPOST /mailboxes?task=reIndex&mode=fixOutdated',
    params: [
      { key: 'messagesPerSecond', defaultValue: '50', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_reindexing_action',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    name: 'Reindex all data in OpenSearch (reindex all mode)',
    taskKey: TaskKey.REINDEX,
    mode: ReIndexMode.REBUILD_ALL,
    command: 'curl -XPOST /mailboxes?task=reIndex&mode=rebuildAll',
    params: [
      { key: 'messagesPerSecond', defaultValue: '50', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_reindexing_action',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    name: 'Fix mailbox inconsistencies',
    taskKey: TaskKey.FIX_MAILBOX_INCONSISTENCIES,
    command: 'curl -XPOST /mailboxes?task=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_fixing_mailboxes_inconsistencies',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    name: 'Fix message inconsistencies',
    taskKey: TaskKey.FIX_MESSAGE_INCONSISTENCIES,
    command: 'curl -XPOST /messages?task=SolveInconsistencies',
    params: [
      { key: 'messagesPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_fixing_message_inconsistencies_2',
    allowanceCheck: { verb: 'POST', pattern: '/messages' },
  },
  {
    name: 'Recompute mailbox counters',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_COUNTERS,
    command: 'curl -XPOST /mailboxes?task=RecomputeMailboxCounters',
    params: [
      { key: 'trustMessageProjection', defaultValue: false, type: 'checkbox' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_recomputing_mailbox_counters',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    name: 'Recompute mailbox quota',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_QUOTA,
    command: 'curl -XPOST /quota/users?task=RecomputeCurrentQuotas',
    params: [
      { key: 'usersPerSecond', defaultValue: '1', type: 'input' },
      { key: 'quotaComponent', values: ['MAILBOX', 'SIEVE', 'JMAP_UPLOADS'], type: 'select' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_recomputing_current_quotas_for_users',
    allowanceCheck: { verb: 'POST', pattern: '/quota/users' },
  },
  {
    name: 'Fix mapping denormalization',
    taskKey: TaskKey.FIX_MAPPING_DENORMALIZATION,
    command: 'curl -XPOST /cassandra/mappings?action=SolveInconsistenciescurl -XPOST /cassandra/mappings?action=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_operations_on_mappings_sources',
    allowanceCheck: { verb: 'POST', pattern: '/cassandra/mappings' },
  },
  {
    name: 'Cleanup JMAP uploads',
    taskKey: TaskKey.CLEANUP_JMAP_UPLOADS,
    command: 'curl -XDELETE /jmap/uploads?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_cleaning_upload_repository',
    allowanceCheck: { verb: 'DELETE', pattern: '/jmap/uploads' },
  },
  {
    name: 'Blob garbage collection',
    taskKey: TaskKey.BLOB_GARBAGE_COLLECTION,
    command: 'curl -XDELETE /blobs?scope=unreferenced',
    params: [
      { key: 'associatedProbability', defaultValue: '0.01', type: 'input' },
      { key: 'expectedBlobCount', defaultValue: '1.000.000', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_running_blob_garbage_collection',
    allowanceCheck: { verb: 'DELETE', pattern: '/blobs' },
  },
  {
    name: 'Reindex contacts from sent mailbox',
    taskKey: TaskKey.CONTACT_INDEXING,
    command: 'curl -XPOST /mailboxes?task=ContactIndexing',
    params: [
      { key: 'usersPerSecond', defaultValue: '1', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_contact_indexing',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    name: 'Purge Deleted Messages',
    taskKey: TaskKey.PURGE_DELETED_MESSAGES,
    command: 'curl -XDELETE /deletedMessages?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_purging_expired_deleted_messages',
    allowanceCheck: { verb: 'DELETE', pattern: '/deletedMessages' },
  },
];

const CLEANUP_PARAMS: TaskParam[] = [
  { key: "olderThan", defaultValue: "5d", type: "input" },
];

const MAIL_HEADER_SUBTITLE = "Common tasks for data maintenance of a Twake Mail server";
const CALENDAR_HEADER_SUBTITLE = "Common tasks for data maintenance of a Twake Calendar server";

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_task_management";

const CALENDAR_TASKS: TaskProps[] = [
  {
    name: 'Import LDAP users',
    taskKey: TaskKey.IMPORT_LDAP_USERS,
    command: 'curl -XPOST /registeredUsers/tasks?task=importFromLDAP&usersPerSecond=100',
    params: [
      { key: 'usersPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    name: 'Domain member synchronization',
    taskKey: TaskKey.DOMAIN_MEMBER_SYNC,
    command: 'curl -XPOST /addressbook/domain-members?task=sync',
    params: [
      { key: 'ignoredDomains', defaultValue: '', type: 'input' },
    ],
    doc: '',
  },
  {
    name: 'Calendar event reindexing',
    taskKey: TaskKey.CALENDAR_EVENT_REINDEX,
    command: 'curl -XPOST /calendars?task=reindex&eventsPerSecond=100',
    params: [
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    name: 'Calendar event archival',
    taskKey: TaskKey.CALENDAR_EVENT_ARCHIVAL,
    command: 'curl -XPOST /calendars?task=archive',
    params: [
      { key: 'createdBefore', defaultValue: '', type: 'duration' },
      { key: 'lastModifiedBefore', defaultValue: '', type: 'duration' },
      { key: 'masterDtStartBefore', defaultValue: '', type: 'duration' },
      { key: 'isRejected', defaultValue: '', type: 'select', values: ['', 'true', 'false'] },
      { key: 'isNotRecurring', defaultValue: '', type: 'select', values: ['', 'true', 'false'] },
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    name: 'Alarm rescheduling',
    taskKey: TaskKey.ALARM_RESCHEDULING,
    command: 'curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100',
    params: [
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    name: 'Add missing fields to registered users',
    taskKey: TaskKey.ADD_MISSING_FIELDS,
    command: 'curl -XPOST /registeredUsers?action=addMissingFields',
    params: [],
    doc: '',
  },
];

export default function CommonTasks() {
  if (appConfig.application === 'CALENDAR') {
    return (
      <div className="p-4 relative w-fit">
        <Header headerSubTitle={CALENDAR_HEADER_SUBTITLE} docuUrl="" />
        <div className="grid grid-cols-1 gap-4 mt-4">
          {CALENDAR_TASKS.map((task) => (
            <TaskContainer {...task} key={task.name} />
          ))}
        </div>
      </div>
    );
  }

  return <MailCommonTasks />;
}

function MailCommonTasks() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canReloadCerts = useIsAllowed("POST", "/servers");
  const canRepositionRights = useIsAllowed("POST", "/team-mailboxes");
  const canCleanupMailbox = useIsAllowed("DELETE", "/messages");
  const canCleanupOldTasks = useIsAllowed("DELETE", "/tasks");
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadPort, setReloadPort] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("30");
  const [repositionLoading, setRepositionLoading] = useState(false);
  const [cleanupTrashLoading, setCleanupTrashLoading] = useState(false);
  const [cleanupSpamLoading, setCleanupSpamLoading] = useState(false);

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

  const handleCleanupTrash = async () => {
    let olderThan = "5d";
    const result = await confirm({
      header: "Cleanup Trash folder",
      message: (
        <ConfirmTaskContent
          message={<p>Delete messages older than the grace period from the <strong>Trash</strong> folder of all users.</p>}
          command={`curl -XDELETE "/messages?olderThan=5d&mailbox=Trash&useSavedDate"`}
          params={CLEANUP_PARAMS}
          getParamValues={(key, value) => {
            if (key === "olderThan") olderThan = value as string;
          }}
        />
      ),
    });
    if (!result) return;

    setCleanupTrashLoading(true);
    try {
      const data = await cleanupMailbox("Trash", olderThan);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({ title: "Error cleaning up Trash", description: <ErrorDisplayer error={err} /> });
    } finally {
      setCleanupTrashLoading(false);
    }
  };

  const handleCleanupSpam = async () => {
    let olderThan = "5d";
    const result = await confirm({
      header: "Cleanup Spam folder",
      message: (
        <ConfirmTaskContent
          message={<p>Delete messages older than the grace period from the <strong>Spam</strong> folder of all users.</p>}
          command={`curl -XDELETE "/messages?olderThan=5d&mailbox=Spam&useSavedDate"`}
          params={CLEANUP_PARAMS}
          getParamValues={(key, value) => {
            if (key === "olderThan") olderThan = value as string;
          }}
        />
      ),
    });
    if (!result) return;

    setCleanupSpamLoading(true);
    try {
      const data = await cleanupMailbox("Spam", olderThan);
      toast({
        title: "Task is running",
        description: <p>Task <a className="text-blue-500 hover:underline" href={`/task/${data.taskId}`}>{data.taskId}</a></p>,
      });
    } catch (err) {
      toast({ title: "Error cleaning up Spam", description: <ErrorDisplayer error={err} /> });
    } finally {
      setCleanupSpamLoading(false);
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

  const handleRepositionSystemRights = async () => {
    const confirmed = await confirm({
      header: "Reposition System Rights",
      message: "Ensure admin and self system users have full rights on all folders of all team mailboxes across all domains? This may take a while.",
    });
    if (!confirmed) return;

    setRepositionLoading(true);
    try {
      await repositionTeamMailboxSystemRights();
      toast({ title: "System rights repositioned successfully" });
    } catch (err) {
      toast({
        title: "Error repositioning system rights",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setRepositionLoading(false);
    }
  };

  return (
    <div className="p-4 relative w-fit">
      <Header
        headerSubTitle={MAIL_HEADER_SUBTITLE}
        docuUrl={docuUrl}
      />

      <div className="grid grid-cols-1 gap-4 mt-4">
        {TASKS.map((task) => (
          <TaskContainer {...task} key={task.name} />
        ))}
        {canReloadCerts && (
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
        )}
        {canRepositionRights && (
          <div className="flex justify-between items-center gap-4">
            <p>Reposition system rights on all Team Mailbox folders</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700 rounded-sm" onClick={handleRepositionSystemRights}>
                    {repositionLoading && <Loader2 className="animate-spin" />}
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XPOST /team-mailboxes?action=repositionSystemRights
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {canCleanupMailbox && (
          <div className="flex justify-between items-center gap-4">
            <p>Cleanup Trash folder (all users)</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupTrash}>
                    {cleanupTrashLoading && <Loader2 className="animate-spin" />}
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XDELETE /messages?olderThan=5d&amp;mailbox=Trash&amp;useSavedDate
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {canCleanupMailbox && (
          <div className="flex justify-between items-center gap-4">
            <p>Cleanup Spam folder (all users)</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupSpam}>
                    {cleanupSpamLoading && <Loader2 className="animate-spin" />}
                    Run
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  curl -XDELETE /messages?olderThan=5d&amp;mailbox=Spam&amp;useSavedDate
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {canCleanupOldTasks && (
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
        )}
      </div>
    </div>
  );
}
