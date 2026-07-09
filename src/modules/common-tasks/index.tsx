import { Fragment, useState } from "react";
import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { ReIndexMode, TaskKey, TaskProps } from "./types";

import { reloadCertificates, cleanupOldTasks, repositionTeamMailboxSystemRights, cleanupMailbox, runAllUsersReindexTask } from "./api-client";
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
    nameKey: 'commonTasks.reindexFixOutdated',
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
    nameKey: 'commonTasks.reindexRebuildAll',
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
    nameKey: 'commonTasks.fixMailboxInconsistencies',
    taskKey: TaskKey.FIX_MAILBOX_INCONSISTENCIES,
    command: 'curl -XPOST /mailboxes?task=SolveInconsistencies',
    params: [
      { key: 'maxIterations', defaultValue: '5', type: 'input' },
      { key: 'autoMerge', defaultValue: false, type: 'checkbox' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_fixing_mailboxes_inconsistencies',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    nameKey: 'commonTasks.fixMessageInconsistencies',
    taskKey: TaskKey.FIX_MESSAGE_INCONSISTENCIES,
    command: 'curl -XPOST /messages?task=SolveInconsistencies',
    params: [
      { key: 'messagesPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_fixing_message_inconsistencies_2',
    allowanceCheck: { verb: 'POST', pattern: '/messages' },
  },
  {
    nameKey: 'commonTasks.recomputeMailboxCounters',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_COUNTERS,
    command: 'curl -XPOST /mailboxes?task=RecomputeMailboxCounters',
    params: [
      { key: 'trustMessageProjection', defaultValue: false, type: 'checkbox' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_recomputing_mailbox_counters',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    nameKey: 'commonTasks.recomputeMailboxQuota',
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
    nameKey: 'commonTasks.fixMappingDenormalization',
    taskKey: TaskKey.FIX_MAPPING_DENORMALIZATION,
    command: 'curl -XPOST /cassandra/mappings?action=SolveInconsistenciescurl -XPOST /cassandra/mappings?action=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_operations_on_mappings_sources',
    allowanceCheck: { verb: 'POST', pattern: '/cassandra/mappings' },
  },
  {
    nameKey: 'commonTasks.cleanupJmapUploads',
    taskKey: TaskKey.CLEANUP_JMAP_UPLOADS,
    command: 'curl -XDELETE /jmap/uploads?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_cleaning_upload_repository',
    allowanceCheck: { verb: 'DELETE', pattern: '/jmap/uploads' },
  },
  {
    nameKey: 'commonTasks.blobGarbageCollection',
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
    nameKey: 'commonTasks.reindexContacts',
    taskKey: TaskKey.CONTACT_INDEXING,
    command: 'curl -XPOST /mailboxes?task=ContactIndexing',
    params: [
      { key: 'usersPerSecond', defaultValue: '1', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_contact_indexing',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    nameKey: 'commonTasks.purgeDeletedMessages',
    taskKey: TaskKey.PURGE_DELETED_MESSAGES,
    command: 'curl -XDELETE /deletedMessages?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_purging_expired_deleted_messages',
    allowanceCheck: { verb: 'DELETE', pattern: '/deletedMessages' },
  },
  {
    nameKey: 'commonTasks.populateEmailQueryView',
    taskKey: TaskKey.POPULATE_EMAIL_QUERY_VIEW,
    command: 'curl -XPOST /mailboxes?task=populateEmailQueryView',
    params: [
      { key: 'messagesPerSecond', defaultValue: '10', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_populate_email_query_view',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
];

const CLEANUP_PARAMS: TaskParam[] = [
  { key: "olderThan", defaultValue: "5d", type: "input" },
];

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_task_management";

const CALENDAR_TASKS: TaskProps[] = [
  {
    nameKey: 'commonTasks.importLdapUsers',
    taskKey: TaskKey.IMPORT_LDAP_USERS,
    command: 'curl -XPOST /registeredUsers/tasks?task=importFromLDAP&usersPerSecond=100',
    params: [
      { key: 'usersPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    nameKey: 'commonTasks.domainMemberSync',
    taskKey: TaskKey.DOMAIN_MEMBER_SYNC,
    command: 'curl -XPOST /addressbook/domain-members?task=sync',
    params: [
      { key: 'ignoredDomains', defaultValue: '', type: 'input' },
      { key: 'ldapFilter', defaultValue: '', type: 'input' },
    ],
    doc: '',
  },
  {
    nameKey: 'commonTasks.calendarEventReindex',
    taskKey: TaskKey.CALENDAR_EVENT_REINDEX,
    command: 'curl -XPOST /calendars?task=reindex&eventsPerSecond=100',
    params: [
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    nameKey: 'commonTasks.calendarEventArchival',
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
    nameKey: 'commonTasks.alarmRescheduling',
    taskKey: TaskKey.ALARM_RESCHEDULING,
    command: 'curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100',
    params: [
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: '',
  },
  {
    nameKey: 'commonTasks.addMissingFields',
    taskKey: TaskKey.ADD_MISSING_FIELDS,
    command: 'curl -XPOST /registeredUsers?action=addMissingFields',
    params: [],
    doc: '',
  },
  {
    nameKey: 'commonTasks.clearDomainMembersContacts',
    taskKey: TaskKey.CLEAR_DOMAIN_MEMBERS_CONTACTS,
    command: 'curl -XDELETE /addressbook/domain-members',
    params: [
      { key: 'ignoredDomains', defaultValue: '', type: 'input' },
    ],
    doc: '',
    danger: true,
  },
];

export default function CommonTasks() {
  const { t } = useTranslation();
  if (appConfig.application === 'CALENDAR') {
    return (
      <div className="p-4 relative w-fit">
        <Header headerTitle={t("commonTasks.title")} headerSubTitle={t("commonTasks.subtitleCalendar")} docuUrl="" />
        <div className="grid grid-cols-1 gap-4 mt-4">
          {CALENDAR_TASKS.map((task) => (
            <TaskContainer {...task} key={task.nameKey} />
          ))}
        </div>
      </div>
    );
  }

  return <MailCommonTasks />;
}

function MailCommonTasks() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canReloadCerts = useIsAllowed("POST", "/servers");
  const canRepositionRights = useIsAllowed("POST", "/team-mailboxes");
  const canCleanupMailbox = useIsAllowed("DELETE", "/messages");
  const canCleanupOldTasks = useIsAllowed("DELETE", "/tasks");
  const canReindexUsers = useIsAllowed("POST", "/users");
  const [perUserReindexLoading, setPerUserReindexLoading] = useState(false);
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadPort, setReloadPort] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("30");
  const [repositionLoading, setRepositionLoading] = useState(false);
  const [cleanupTrashLoading, setCleanupTrashLoading] = useState(false);
  const [cleanupSpamLoading, setCleanupSpamLoading] = useState(false);

  const handleReloadCertificates = async () => {
    const confirmed = await confirm({
      header: t("commonTasks.reloadCertTitle"),
      message: t("commonTasks.reloadCertConfirm", { port: reloadPort ? ` for port ${reloadPort}` : " for all ports" }),
    });
    if (!confirmed) return;

    setReloadLoading(true);
    try {
      await reloadCertificates(reloadPort || undefined);
      toast({ title: t("commonTasks.reloadCertSuccess") });
    } catch (err) {
      toast({
        title: t("commonTasks.errorReloadCert"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setReloadLoading(false);
    }
  };

  const handleCleanupTrash = async () => {
    let olderThan = "5d";
    const result = await confirm({
      header: t("users.tasks.cleanupTrashTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("commonTasks.cleanupTrashAllDesc")}</p>}
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({ title: t("commonTasks.errorCleanupTrash"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCleanupTrashLoading(false);
    }
  };

  const handleCleanupSpam = async () => {
    let olderThan = "5d";
    const result = await confirm({
      header: t("users.tasks.cleanupSpamTitle"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("commonTasks.cleanupSpamAllDesc")}</p>}
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
        title: t("common.taskRunning"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${data.taskId}`}>{t("common.taskLink", { taskId: data.taskId })}</Link></p>,
      });
    } catch (err) {
      toast({ title: t("commonTasks.errorCleanupSpam"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCleanupSpamLoading(false);
    }
  };

  const handleCleanupOldTasks = async () => {
    const days = parseInt(cleanupDays);
    if (isNaN(days) || days <= 0) return;
    const confirmed = await confirm({
      header: t("commonTasks.cleanupOldTasks"),
      message: t("commonTasks.cleanupOldTasksConfirm", { days }),
    });
    if (!confirmed) return;

    setCleanupLoading(true);
    try {
      await cleanupOldTasks(days);
      toast({ title: t("commonTasks.cleanupOldTasksSuccess", { days }) });
    } catch (err) {
      toast({
        title: t("commonTasks.errorCleanupOldTasks"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const handlePerUserReindex = async () => {
    let messagesPerSecond = "50";
    const confirmed = await confirm({
      header: t("commonTasks.perUserReindex"),
      message: (
        <ConfirmTaskContent
          message={<p>{t("commonTasks.runConfirm", { name: t("commonTasks.perUserReindex") })}</p>}
          command={`curl -XPOST /users?action=reindex&mode=rebuildAll&messagesPerSecond=50`}
          params={[{ key: "messagesPerSecond", defaultValue: "50", type: "input" }]}
          getParamValues={(key, value) => {
            if (key === "messagesPerSecond") messagesPerSecond = value as string;
          }}
        />
      ),
    });
    if (!confirmed) return;

    setPerUserReindexLoading(true);
    try {
      const data = await runAllUsersReindexTask({ messagesPerSecond });
      const taskIds = Object.values(data ?? {});
      const errors = taskIds.filter((taskId) => !taskId).length;
      const planned = taskIds.length - errors;
      toast({ title: t("commonTasks.perUserReindexSuccess", { planned, errors }) });
    } catch (err) {
      toast({
        title: t("commonTasks.errorPerUserReindex"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setPerUserReindexLoading(false);
    }
  };

  const handleRepositionSystemRights = async () => {
    const confirmed = await confirm({
      header: t("commonTasks.repositionTitle"),
      message: t("commonTasks.repositionConfirm"),
    });
    if (!confirmed) return;

    setRepositionLoading(true);
    try {
      await repositionTeamMailboxSystemRights();
      toast({ title: t("commonTasks.repositionSuccess") });
    } catch (err) {
      toast({
        title: t("commonTasks.errorReposition"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setRepositionLoading(false);
    }
  };

  return (
    <div className="p-4 relative w-fit">
      <Header
        headerTitle={t("commonTasks.title")}
        headerSubTitle={t("commonTasks.subtitleMail")}
        docuUrl={docuUrl}
      />

      <div className="grid grid-cols-1 gap-4 mt-4">
        {TASKS.map((task) => (
          <Fragment key={task.nameKey}>
            <TaskContainer {...task} />
            {task.nameKey === "commonTasks.reindexRebuildAll" && canReindexUsers && (
              <div className="flex justify-between items-center gap-4">
                <p>{t("commonTasks.perUserReindex")}</p>
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handlePerUserReindex}>
                        {perUserReindexLoading && <Loader2 className="animate-spin" />}
                        {t("common.run")}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      curl -XPOST /users?action=reindex&amp;mode=rebuildAll&amp;messagesPerSecond=50
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </Fragment>
        ))}
        {canReloadCerts && (
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <p>{t("commonTasks.reloadCertificates")}</p>
              <input
                type="text"
                placeholder={t("commonTasks.portOptional")}
                value={reloadPort}
                onChange={(e) => setReloadPort(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-32"
              />
            </div>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleReloadCertificates}>
                    {reloadLoading && <Loader2 className="animate-spin" />}
                    {t("common.run")}
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
            <p>{t("commonTasks.repositionSystemRights")}</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-green-400 hover:bg-green-500 rounded-sm" onClick={handleRepositionSystemRights}>
                    {repositionLoading && <Loader2 className="animate-spin" />}
                    {t("common.run")}
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
            <p>{t("commonTasks.cleanupTrashAll")}</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupTrash}>
                    {cleanupTrashLoading && <Loader2 className="animate-spin" />}
                    {t("common.run")}
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
            <p>{t("commonTasks.cleanupSpamAll")}</p>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-yellow-500 hover:bg-yellow-600 rounded-sm" onClick={handleCleanupSpam}>
                    {cleanupSpamLoading && <Loader2 className="animate-spin" />}
                    {t("common.run")}
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
              <p>{t("commonTasks.cleaningUpOldTasks")}</p>
              <input
                type="number"
                min="1"
                placeholder={t("commonTasks.days")}
                value={cleanupDays}
                onChange={(e) => setCleanupDays(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-24"
              />
              <span className="text-sm text-gray-500">{t("commonTasks.days")}</span>
            </div>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600 rounded-sm" onClick={handleCleanupOldTasks}>
                    {cleanupLoading && <Loader2 className="animate-spin" />}
                    {t("common.run")}
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
