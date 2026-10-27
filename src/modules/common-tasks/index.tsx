import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { ReIndexMode, TaskGroup, TaskKey, TaskProps, taskDescriptionKey } from "./types";
import TaskGroups, { TaskEntry } from "./task-groups";

import { reloadCertificates, cleanupOldTasks, repositionTeamMailboxSystemRights, cleanupMailbox, runAllUsersReindexTask, summarizeAllUsersReindex } from "./api-client";
import { parseCleanupDays } from "./cleanup-days";
import ConfirmTaskContent from "./components/confirm-task-content";
import { defaultCommand } from "./components/command-preview";
import { TaskParam } from "./types";
import TaskContainer from "./task-container";
import TaskRow from "@/components/custom/task-row";
import Header from "@/components/custom/header";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { appConfig } from "@/lib/config";
import { CALENDAR_WEBADMIN_DOC_URL, calendarWebadminDoc } from "@/lib/calendar-docs";
import { cleanupTaskLabel } from "@/modules/tasks/task-summary";
import { useSyncSpaces } from "@/modules/twake-space/use-sync-spaces";
import { EVERY_SPACE, syncSpacesCommand } from "@/modules/twake-space/space";

// How a task's risk is set: safe = reads or rebuilds derived data; caution = changes stored
// data, needs a maintenance window or deletes only unreferenced or expired data; destructive =
// permanently deletes user data.
const tmailWebadminDoc = (anchor: string) =>
  `https://github.com/linagora/tmail-backend/blob/master/docs/modules/ROOT/pages/tmail-backend/webadmin.adoc#${anchor}`;

const TASKS: TaskProps[] = [
  {
    nameKey: 'commonTasks.reindexFixOutdated',
    group: 'search',
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
    group: 'search',
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
    group: 'consistency',
    taskKey: TaskKey.FIX_MAILBOX_INCONSISTENCIES,
    command: 'curl -XPOST /mailboxes?task=SolveInconsistencies',
    params: [
      { key: 'maxIterations', defaultValue: '5', type: 'input' },
      { key: 'autoMerge', defaultValue: false, type: 'checkbox' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_fixing_mailboxes_inconsistencies',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
    risk: 'caution',
    consequenceKey: 'confirm.consequence.fixMailboxInconsistencies',
  },
  {
    nameKey: 'commonTasks.fixMessageInconsistencies',
    group: 'consistency',
    taskKey: TaskKey.FIX_MESSAGE_INCONSISTENCIES,
    command: 'curl -XPOST /messages?task=SolveInconsistencies',
    params: [
      { key: 'messagesPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_fixing_message_inconsistencies_2',
    allowanceCheck: { verb: 'POST', pattern: '/messages' },
    risk: 'caution',
  },
  {
    nameKey: 'commonTasks.recomputeMailboxCounters',
    group: 'consistency',
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
    group: 'consistency',
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
    group: 'consistency',
    taskKey: TaskKey.FIX_MAPPING_DENORMALIZATION,
    command: 'curl -XPOST /cassandra/mappings?action=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_operations_on_mappings_sources',
    allowanceCheck: { verb: 'POST', pattern: '/cassandra/mappings' },
  },
  {
    nameKey: 'commonTasks.cleanupJmapUploads',
    group: 'cleanup',
    taskKey: TaskKey.CLEANUP_JMAP_UPLOADS,
    command: 'curl -XDELETE /jmap/uploads?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_cleaning_upload_repository',
    allowanceCheck: { verb: 'DELETE', pattern: '/jmap/uploads' },
    risk: 'caution',
  },
  {
    nameKey: 'commonTasks.blobGarbageCollection',
    group: 'cleanup',
    taskKey: TaskKey.BLOB_GARBAGE_COLLECTION,
    command: 'curl -XDELETE /blobs?scope=unreferenced',
    params: [
      { key: 'associatedProbability', defaultValue: '0.01', type: 'input' },
      { key: 'expectedBlobCount', defaultValue: '1000000', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_running_blob_garbage_collection',
    allowanceCheck: { verb: 'DELETE', pattern: '/blobs' },
    // Only unreferenced or expired data: no word to type
    risk: 'caution',
    consequenceKey: 'confirm.consequence.blobGarbageCollection',
  },
  {
    nameKey: 'commonTasks.reindexContacts',
    group: 'search',
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
    group: 'cleanup',
    taskKey: TaskKey.PURGE_DELETED_MESSAGES,
    command: 'curl -XDELETE /deletedMessages?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_purging_expired_deleted_messages',
    allowanceCheck: { verb: 'DELETE', pattern: '/deletedMessages' },
    // Only unreferenced or expired data: no word to type
    risk: 'caution',
    consequenceKey: 'confirm.consequence.purgeDeletedMessages',
  },
  {
    nameKey: 'commonTasks.populateEmailQueryView',
    group: 'search',
    taskKey: TaskKey.POPULATE_EMAIL_QUERY_VIEW,
    command: 'curl -XPOST /mailboxes?task=populateEmailQueryView',
    params: [
      { key: 'messagesPerSecond', defaultValue: '10', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_populate_email_query_view',
    allowanceCheck: { verb: 'POST', pattern: '/mailboxes' },
  },
  {
    nameKey: 'commonTasks.twakeSpaceReindex',
    group: 'space',
    taskKey: TaskKey.TWAKE_SPACE_REINDEX,
    command: 'curl -XPOST /spaces?action=reindex',
    doc: tmailWebadminDoc('rebuilding-the-space-index'),
    // Granted apart from the purge, which deletes team mailboxes
    allowanceCheck: { verb: 'POST', pattern: '/spaces?action=reindex' },
    unavailableKey: 'commonTasks.twakeSpaceUnavailable',
  },
  {
    nameKey: 'commonTasks.twakeSpacePurge',
    group: 'space',
    taskKey: TaskKey.TWAKE_SPACE_PURGE,
    command: 'curl -XPOST /spaces?action=purge',
    doc: tmailWebadminDoc('purging-the-team-mailboxes-of-deleted-spaces'),
    allowanceCheck: { verb: 'POST', pattern: '/spaces?action=purge' },
    risk: 'destructive',
    consequenceKey: 'confirm.consequence.twakeSpacePurge',
    typeToConfirmKey: 'confirm.deleteWord',
    unavailableKey: 'commonTasks.twakeSpaceUnavailable',
  },
];

const CLEANUP_PARAMS: TaskParam[] = [
  { key: "olderThan", defaultValue: "5d", type: "input" },
];

// Shared by the dialog and the Run tooltip, so that both show the same command
const cleanupCommand = (mailbox: "Trash" | "Spam") =>
  `curl -XDELETE "/messages?olderThan=5d&mailbox=${mailbox}&useSavedDate"`;

const MAIL_GROUPS: TaskGroup[] = ["search", "consistency", "cleanup", "space", "server"];
const CALENDAR_GROUPS: TaskGroup[] = ["directory", "search", "consistency", "cleanup"];

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_task_management";

const CALENDAR_TASKS: TaskProps[] = [
  {
    nameKey: 'commonTasks.importLdapUsers',
    group: 'directory',
    taskKey: TaskKey.IMPORT_LDAP_USERS,
    command: 'curl -XPOST /registeredUsers/tasks?task=importFromLDAP&usersPerSecond=100',
    params: [
      { key: 'usersPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: calendarWebadminDoc('import-ldap-users'),
  },
  {
    nameKey: 'commonTasks.domainMemberSync',
    group: 'directory',
    taskKey: TaskKey.DOMAIN_MEMBER_SYNC,
    command: 'curl -XPOST /addressbook/domain-members?task=sync',
    params: [
      { key: 'ignoredDomains', defaultValue: '', type: 'input' },
      { key: 'ldapFilter', defaultValue: '', type: 'input' },
    ],
    doc: calendarWebadminDoc('domain-member-synchronisation'),
  },
  {
    nameKey: 'commonTasks.calendarEventReindex',
    group: 'search',
    taskKey: TaskKey.CALENDAR_EVENT_REINDEX,
    command: 'curl -XPOST /calendars?task=reindex&eventsPerSecond=100',
    params: [
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: calendarWebadminDoc('calendar-event-reindexing'),
  },
  {
    nameKey: 'commonTasks.calendarEventArchival',
    group: 'cleanup',
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
    doc: calendarWebadminDoc('calendar-event-archival'),
    risk: 'caution',
  },
  {
    nameKey: 'commonTasks.alarmRescheduling',
    group: 'consistency',
    taskKey: TaskKey.ALARM_RESCHEDULING,
    command: 'curl -XPOST /calendars?task=scheduleAlarms&eventsPerSecond=100',
    params: [
      { key: 'eventsPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: calendarWebadminDoc('alarm-rescheduling'),
  },
  {
    nameKey: 'commonTasks.addMissingFields',
    group: 'directory',
    taskKey: TaskKey.ADD_MISSING_FIELDS,
    command: 'curl -XPOST /registeredUsers?action=addMissingFields',
    params: [],
    doc: calendarWebadminDoc('add-missing-fields-to-registered-users'),
  },
  {
    nameKey: 'commonTasks.republishCommonContacts',
    group: 'directory',
    taskKey: TaskKey.REPUBLISH_COMMON_CONTACTS,
    command: 'curl -XPOST /contacts?action=republish&contactsPerSecond=100',
    params: [
      { key: 'contactsPerSecond', defaultValue: '100', type: 'input' },
      { key: 'scope', defaultValue: '', type: 'select', values: ['', 'domain', 'user'] },
    ],
    doc: calendarWebadminDoc('common-contacts-routes'),
    allowanceCheck: { verb: 'POST', pattern: '/contacts?action=republish' },
  },
  {
    nameKey: 'commonTasks.clearDomainMembersContacts',
    group: 'cleanup',
    taskKey: TaskKey.CLEAR_DOMAIN_MEMBERS_CONTACTS,
    command: 'curl -XDELETE /addressbook/domain-members',
    params: [
      { key: 'ignoredDomains', defaultValue: '', type: 'input' },
    ],
    doc: calendarWebadminDoc('delete-domain-members-contacts'),
    risk: 'destructive',
    consequenceKey: 'confirm.consequence.clearDomainMembersContacts',
    typeToConfirmKey: 'confirm.deleteWord',
  },
];

export default function CommonTasks() {
  const { t } = useTranslation();
  if (appConfig.application === 'CALENDAR') {
    return (
      <div className="p-4 relative w-fit max-w-full">
        <Header headerTitle={t("commonTasks.title")} headerSubTitle={t("commonTasks.subtitleCalendar")} docuUrl={CALENDAR_WEBADMIN_DOC_URL} />
        <TaskGroups
          order={CALENDAR_GROUPS}
          entries={CALENDAR_TASKS.map((task) => ({ nameKey: task.nameKey, group: task.group!, risk: task.risk, node: <TaskContainer {...task} /> }))}
        />
      </div>
    );
  }

  return <MailCommonTasks />;
}

function MailCommonTasks() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const canReloadCerts = useIsAllowed("POST", "/servers");
  const canRepositionRights = useIsAllowed("POST", "/team-mailboxes");
  const canCleanupMailbox = useIsAllowed("DELETE", "/messages");
  const canCleanupOldTasks = useIsAllowed("DELETE", "/tasks");
  const canReindexUsers = useIsAllowed("POST", "/users");
  const canSyncSpaces = useIsAllowed("POST", "/spaces?action=sync");
  const syncSpaces = useSyncSpaces();
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadPort, setReloadPort] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("30");
  const [repositionLoading, setRepositionLoading] = useState(false);

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

  const handleCleanupMailbox = async (mailbox: "Trash" | "Spam") => {
    let olderThan = "5d";
    await confirm({
      header: t(`commonTasks.cleanup${mailbox}All`),
      message: (
        <ConfirmTaskContent
          message={<p>{t(`commonTasks.cleanup${mailbox}AllDesc`)}</p>}
          command={cleanupCommand(mailbox)}
          params={CLEANUP_PARAMS}
          getParamValues={(key, value) => {
            if (key === "olderThan") olderThan = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await cleanupMailbox(mailbox, olderThan);
        toastTaskCreated(data.taskId, undefined, cleanupTaskLabel(t, mailbox, false));
      },
    });
  };

  const cleanupDaysValue = parseCleanupDays(cleanupDays);

  const handleCleanupOldTasks = async () => {
    const days = cleanupDaysValue;
    if (days === null) return;
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
    await confirm({
      header: t("commonTasks.perUserReindex"),
      message: (
        <ConfirmTaskContent
          message={<p>{t(taskDescriptionKey("commonTasks.perUserReindex"))}</p>}
          command={`curl -XPOST /users?action=reindex&mode=rebuildAll&messagesPerSecond=50`}
          params={[{ key: "messagesPerSecond", defaultValue: "50", type: "input" }]}
          getParamValues={(key, value) => {
            if (key === "messagesPerSecond") messagesPerSecond = value as string;
          }}
        />
      ),
      action: async () => {
        const data = await runAllUsersReindexTask({ messagesPerSecond });
        const { planned, errors } = summarizeAllUsersReindex(data);
        toast({ title: t("commonTasks.perUserReindexSuccess", { planned, errors }) });
      },
    });
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

  const entries: TaskEntry[] = [
    ...TASKS.flatMap((task): TaskEntry[] => [
      { nameKey: task.nameKey, group: task.group!, risk: task.risk, node: <TaskContainer {...task} /> },
      // Listed right after the full reindex it splits per user
      ...(task.nameKey === "commonTasks.reindexRebuildAll" && canReindexUsers ? [{
        nameKey: "commonTasks.perUserReindex",
        group: "search" as const,
        node: (
          <TaskRow
            title={t("commonTasks.perUserReindex")}
            description={t(taskDescriptionKey("commonTasks.perUserReindex"))}
            command="curl -XPOST /users?action=reindex&mode=rebuildAll&messagesPerSecond=50"
            onRun={handlePerUserReindex}
          />
        ),
      }] : []),
    ]),
    ...(canRepositionRights ? [{
      nameKey: "commonTasks.repositionSystemRights",
      group: "consistency" as const,
      node: (
        <TaskRow
          title={t("commonTasks.repositionSystemRights")}
          description={t(taskDescriptionKey("commonTasks.repositionSystemRights"))}
          command="curl -XPOST /team-mailboxes?action=repositionSystemRights"
          onRun={handleRepositionSystemRights}
          loading={repositionLoading}
        />
      ),
    }] : []),
    ...(canSyncSpaces ? [{
      nameKey: "commonTasks.syncTwakeSpaces",
      group: "consistency" as const,
      node: (
        <TaskRow
          title={t("commonTasks.syncTwakeSpaces")}
          description={t(taskDescriptionKey("commonTasks.syncTwakeSpaces"))}
          command={syncSpacesCommand(EVERY_SPACE)}
          onRun={() => syncSpaces()}
        />
      ),
    }] : []),
    ...(canCleanupMailbox ? (["Trash", "Spam"] as const).map((mailbox) => ({
      nameKey: `commonTasks.cleanup${mailbox}All`,
      group: "cleanup" as const,
      risk: "caution" as const,
      node: (
        <TaskRow
          title={t(`commonTasks.cleanup${mailbox}All`)}
          description={t(taskDescriptionKey(`commonTasks.cleanup${mailbox}All`))}
          risk="caution"
          command={defaultCommand(cleanupCommand(mailbox), CLEANUP_PARAMS)}
          onRun={() => handleCleanupMailbox(mailbox)}
        />
      ),
    })) : []),
    ...(canCleanupOldTasks ? [{
      nameKey: "commonTasks.cleaningUpOldTasks",
      group: "cleanup" as const,
      risk: "caution" as const,
      node: (
        <TaskRow
          title={t("commonTasks.cleaningUpOldTasks")}
          description={t(taskDescriptionKey("commonTasks.cleaningUpOldTasks"))}
          risk="caution"
          // The request run with the days of the field, as sent by cleanupOldTasks
          command={`curl -XDELETE /tasks?olderThan=${cleanupDaysValue ?? "N"}day`}
          onRun={handleCleanupOldTasks}
          disabled={cleanupDaysValue === null || cleanupLoading}
          loading={cleanupLoading}
        >
          <input
            type="number"
            min="1"
            aria-label={t("commonTasks.days")}
            value={cleanupDays}
            onChange={(e) => setCleanupDays(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-24"
          />
          <span className="text-sm text-gray-500">{t("commonTasks.days")}</span>
          {cleanupDaysValue === null && (
            <span role="alert" className="text-sm text-red-500">{t("commonTasks.invalidCleanupDays")}</span>
          )}
        </TaskRow>
      ),
    }] : []),
    ...(canReloadCerts ? [{
      nameKey: "commonTasks.reloadCertificates",
      group: "server" as const,
      node: (
        <TaskRow
          title={t("commonTasks.reloadCertificates")}
          description={t(taskDescriptionKey("commonTasks.reloadCertificates"))}
          command="curl -XPOST /servers?reload-certificate"
          onRun={handleReloadCertificates}
          loading={reloadLoading}
        >
          <input
            type="text"
            aria-label={t("commonTasks.portOptional")}
            placeholder={t("commonTasks.portOptional")}
            value={reloadPort}
            onChange={(e) => setReloadPort(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-32"
          />
        </TaskRow>
      ),
    }] : []),
  ];

  return (
    <div className="p-4 relative w-fit max-w-full">
      <Header
        headerTitle={t("commonTasks.title")}
        headerSubTitle={t("commonTasks.subtitleMail")}
        docuUrl={docuUrl}
      />

      <TaskGroups order={MAIL_GROUPS} entries={entries} />
    </div>
  );
}
