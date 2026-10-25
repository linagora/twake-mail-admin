import { Fragment, useCallback } from "react";
import { Link } from "react-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { TaskDetailResponse, TaskStatus } from "@/modules/common-tasks/types";
import { cancelTask, getTaskDetail } from "@/modules/common-tasks/api-client";
import { currentLocale } from "@/i18n/locale";
import UserLink from "@/components/custom/user-link";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getResource, getTeamCalendars } from "@/modules/domains/api-client";

// The additionalInformation keys holding a user, shown as a link to their page
const USER_KEYS = new Set(["username", "user", "oldUser", "newUser", "targetUser", "sourceUser"]);

/**
 * A task as the operator reads it, shared by the detail dialog of the Tasks list and by the
 * task page every "Task created" toast leads to: same fields, same labels.
 */

export const STATUS_COLORS: Record<string, string> = {
  [TaskStatus.COMPLETED]: "bg-green-100 text-green-800",
  [TaskStatus.FAILED]: "bg-red-100 text-red-800",
  [TaskStatus.IN_PROGRESS]: "bg-primary/10 text-primary",
  [TaskStatus.WAITING]: "bg-yellow-100 text-yellow-800",
  [TaskStatus.CANCELLED]: "bg-gray-100 text-gray-600",
  [TaskStatus.CANCEL_REQUESTED]: "bg-orange-100 text-orange-800",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  "": "tasks.all",
  [TaskStatus.WAITING]: "tasks.waiting",
  [TaskStatus.IN_PROGRESS]: "tasks.inProgress",
  [TaskStatus.CANCEL_REQUESTED]: "tasks.cancelRequested",
  [TaskStatus.COMPLETED]: "tasks.completed",
  [TaskStatus.CANCELLED]: "tasks.cancelled",
  [TaskStatus.FAILED]: "tasks.failed",
};

export const statusLabel = (t: TFunction, status: string): string =>
  STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status;

/**
 * Cancels a task, then says what became of it: WebAdmin accepts cancelling a task that ended
 * meanwhile, which stays completed or failed. Throws when the cancellation is refused.
 */
export async function cancelAndReport(t: TFunction, id: string, domain?: string): Promise<string> {
  await cancelTask(id, domain);
  try {
    const { status } = await getTaskDetail(id, domain);
    if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
      return t("tasks.alreadyEnded", { status: statusLabel(t, status) });
    }
  } catch {
    // Not readable: the cancellation itself was accepted
  }
  return t("tasks.taskCancelled");
}

// Still running: a page showing it refreshes itself until it is over
export const isRunning = (status: TaskStatus): boolean =>
  status === TaskStatus.WAITING || status === TaskStatus.IN_PROGRESS || status === TaskStatus.CANCEL_REQUESTED;

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString(currentLocale())} ${dt.toLocaleTimeString(currentLocale())}`;
  } catch {
    return d;
  }
}

// A task ends by completing, failing or being cancelled: WebAdmin sets the matching date only
// (spelled canceledDate, with a single L, unlike cancelledFrom)
export function endDate(task: TaskDetailResponse): string | null {
  return task.completedDate ?? task.failedDate ?? task.canceledDate ?? null;
}

/** "0.17 s", "3 min 12 s", "2 h 05 min": from the start to the end of the task. */
export function formatDuration(t: TFunction, milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return t("tasks.durationSeconds", {
      value: seconds.toLocaleString(currentLocale(), { maximumFractionDigits: seconds < 10 ? 2 : 0 }),
    });
  }
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return t("tasks.durationMinutes", { min: totalMinutes, sec: Math.floor(seconds % 60) });
  return t("tasks.durationHours", { h: Math.floor(totalMinutes / 60), min: String(totalMinutes % 60).padStart(2, "0") });
}

function duration(task: TaskDetailResponse): number | null {
  const ended = endDate(task);
  if (!task.startedDate || !ended) return null;
  const ms = new Date(ended).getTime() - new Date(task.startedDate).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

// Readable labels of the additionalInformation keys met most; unknown keys show as-is
const DETAIL_LABEL_KEYS: Record<string, string> = {
  repositoryPath: "tasks.info.repositoryPath",
  initialCount: "tasks.info.initialCount",
  remainingCount: "tasks.info.remainingCount",
  processedUserCount: "tasks.info.processedUserCount",
  failedUsers: "tasks.info.failedUsers",
  username: "tasks.info.username",
  mailboxId: "tasks.info.mailboxId",
  domain: "tasks.info.domain",
  processedMailboxes: "tasks.info.processedMailboxes",
  failedMailboxes: "tasks.info.failedMailboxes",
  processedMessageCount: "tasks.info.processedMessageCount",
  failedMessageCount: "tasks.info.failedMessageCount",
  timestamp: "tasks.info.timestamp",
  // Calendar tasks: archival, imports
  targetUser: "tasks.info.username",
  calendarType: "tasks.info.calendarType",
  calendarId: "tasks.info.calendarId",
  totalEventCount: "tasks.info.totalEventCount",
  importedEventCount: "tasks.info.importedEventCount",
  archivedEventCount: "tasks.info.archivedEventCount",
  failedEventCount: "tasks.info.failedEventCount",
  processedEventCount: "tasks.info.processedEventCount",
  addressBookId: "tasks.info.addressBookId",
  totalContactCount: "tasks.info.totalContactCount",
  importedContactCount: "tasks.info.importedContactCount",
  failedContactCount: "tasks.info.failedContactCount",
  // Add missing fields of registered users
  processedUsers: "tasks.info.processedUserCount",
  upgradedUsers: "tasks.info.upgradedUsers",
  errorCount: "tasks.info.errorCount",
  // Reindexing and vault restores
  successfullyReprocessedMailCount: "tasks.info.reprocessedMailCount",
  failedReprocessedMailCount: "tasks.info.failedReprocessedMailCount",
  successfulRestoreCount: "tasks.info.restoredCount",
  errorRestoreCount: "tasks.info.failedRestoreCount",
  // Templates provisioning of a user or a domain: its options as the dialog names them
  sourceUser: "provisionTemplates.sourceUser",
  folderName: "provisionTemplates.folderName",
  overwriteExisting: "provisionTemplates.overwriteExisting",
  prune: "provisionTemplates.prune",
  usersPerSecond: "provisionTemplates.usersPerSecond",
  appliedTemplates: "tasks.info.appliedTemplates",
  skippedTemplates: "tasks.info.skippedTemplates",
  removedTemplates: "tasks.info.removedTemplates",
  // Recompute mailbox quota: a quota root is a user
  processedQuotaRoots: "tasks.info.processedUserCount",
  failedQuotaRoots: "tasks.info.failedUsers",
  // Trash and Spam cleanups (ExpireMailboxTask)
  mailboxesProcessed: "tasks.info.processedMailboxes",
  mailboxesFailed: "tasks.info.failedMailboxes",
  mailboxesExpired: "tasks.info.mailboxesExpired",
  messagesDeleted: "tasks.info.messagesDeleted",
  // Subscribe to all mailboxes
  subscribedCount: "tasks.info.subscribedCount",
  unsubscribedCount: "tasks.info.unsubscribedCount",
};

// Shown above the details already, or nested values left to the raw JSON
const isDetailShown = (key: string, value: unknown) =>
  value !== null && value !== undefined && key !== "type"
  && !(typeof value === "object" && !(Array.isArray(value) && value.every((item) => typeof item !== "object")));

// A list of names or ids, e.g. the failed users: its items, or a dash when empty
// Options such as overwriteExisting read "Yes" / "No", as the dialog that set them
const detailText = (t: TFunction, value: unknown) =>
  typeof value === "boolean" ? t(value ? "common.yes" : "common.no")
    : Array.isArray(value) ? (value.length > 0 ? value.join(", ") : "—")
    : String(value);

// Values of calendarType named in the UI language
const CALENDAR_TYPE_KEYS: Record<string, string> = {
  "team-calendar": "tasks.info.calendarTypes.team-calendar",
  resource: "tasks.info.calendarTypes.resource",
};

/**
 * The name of each WebAdmin task type, as the button that starts it reads: the operator finds
 * on the Tasks list the words they clicked, not the internal key (BlobGCTask, user-reindexing).
 * Keys are the `type` WebAdmin reports in GET /tasks/{id}, values i18n keys. Several types may
 * share a name: the same button starts a different task on James and on TMail.
 */
export const TASK_TYPE_LABEL_KEYS: Record<string, string> = {
  // Common Tasks (mail)
  "full-reindexing": "taskTypes.fullReindexing",
  "solve-mailbox-inconsistencies": "commonTasks.fixMailboxInconsistencies",
  "solve-message-inconsistencies": "commonTasks.fixMessageInconsistencies",
  "recompute-mailbox-counters": "commonTasks.recomputeMailboxCounters",
  "recompute-current-quotas": "commonTasks.recomputeMailboxQuota",
  "cassandra-mappings-solve-inconsistencies": "commonTasks.fixMappingDenormalization",
  UploadRepositoryCleanupTask: "commonTasks.cleanupJmapUploads",
  BlobGCTask: "commonTasks.blobGarbageCollection",
  ContactIndexing: "commonTasks.reindexContacts",
  DeletedMessageVaultDeleteExpiredMessagesTask: "commonTasks.purgeDeletedMessages",
  "deleted-messages-delete": "commonTasks.purgeDeletedMessages",
  // TMail purges the expired messages of the vault by removing whole blob buckets
  "tmail-deleted-messages-blob-store-based-garbage-collection": "commonTasks.purgeDeletedMessages",
  PopulateEmailQueryViewTask: "commonTasks.populateEmailQueryView",
  ExpireMailboxTask: "taskTypes.expireMailbox",
  "tasks-cleanup": "commonTasks.cleaningUpOldTasks",
  "cassandra-migration": "cassandra.upgradeTitle",
  // User tasks
  "user-reindexing": "users.tasks.reindexAll",
  "mailbox-reindexing": "taskTypes.mailboxReindexing",
  SubscribeAllTask: "users.tasks.subscribeAll",
  RecomputeUserFastViewProjectionItemsTask: "users.tasks.fastView",
  "deleted-messages-restore": "users.tasks.restoreDeleted",
  "team-mailbox-deleted-messages-restore": "users.tasks.restoreDeleted",
  UsernameChangeTask: "users.tasks.renameUser",
  DeleteUserDataTask: "users.tasks.deleteData",
  UserDataTieringTask: "users.tasks.tierData",
  UserTemplatesProvisionTask: "users.tasks.provisionTemplates",
  ClearMailboxContentTask: "users.mailboxes.clearTooltip",
  // Domain tasks
  DomainTemplatesProvisionTask: "domains.tasks.provisionTemplates",
  DeleteUsersDataOfDomainTask: "domains.tasks.deleteAllData",
  // Mail repositories and dead-lettered events
  "reprocessing-all": "mailRepositories.reprocessAll",
  "reprocessing-one": "mailRepositories.reprocessMailTooltip",
  "clear-mail-repository": "mailRepositories.clearAll",
  "event-dead-letters-redeliver-group": "eventDeadletter.redeliverGroupAction",
  "event-dead-letters-redeliver-all": "eventDeadletter.redeliverAll",
  "event-dead-letters-redeliver-one": "taskTypes.redeliverOneEvent",
  // Calendar
  "import-ldap-users": "commonTasks.importLdapUsers",
  "sync-domain-members-contacts-ldap-to-dav": "commonTasks.domainMemberSync",
  "reindex-calendar-events": "commonTasks.calendarEventReindex",
  "calendar-archival": "commonTasks.calendarEventArchival",
  "schedule-alarms": "commonTasks.alarmRescheduling",
  "add-missing-fields": "commonTasks.addMissingFields",
  "republish-common-contacts": "commonTasks.republishCommonContacts",
  "clear-domain-members-contacts-dav": "commonTasks.clearDomainMembersContacts",
  "calendar-import": "users.calendars.importTitle",
  "domain-calendar-import": "users.calendars.importTitle",
  "addressbook-import": "users.addressBooks.importTitle",
  "domain-addressbook-import": "users.addressBooks.importTitle",
  "domain-addressbook-copy": "domains.addressBookCounts.copy.title",
  "domain-addressbook-clear": "taskTypes.domainAddressBookClear",
  "booking-link-event-deletion": "taskTypes.bookingLinkEventDeletion",
  "resend-unsent-mails": "unsentMails.resendAllTitle",
  "delete-unsent-mails": "unsentMails.deleteAllTitle",
};

/** The task types of Twake Calendar's WebAdmin; the others are run by James or TMail. */
export const CALENDAR_TASK_TYPES: ReadonlySet<string> = new Set([
  "import-ldap-users",
  "sync-domain-members-contacts-ldap-to-dav",
  "reindex-calendar-events",
  "calendar-archival",
  "schedule-alarms",
  "add-missing-fields",
  "republish-common-contacts",
  "clear-domain-members-contacts-dav",
  "calendar-import",
  "domain-calendar-import",
  "addressbook-import",
  "domain-addressbook-import",
  "domain-addressbook-copy",
  "domain-addressbook-clear",
  "booking-link-event-deletion",
  "resend-unsent-mails",
  "delete-unsent-mails",
]);

/** The task types both WebAdmins run: deleting the data of a user or of a whole domain. */
export const SHARED_TASK_TYPES: ReadonlySet<string> = new Set(["DeleteUserDataTask", "DeleteUsersDataOfDomainTask"]);

/** The name of a task type in the UI language; an unknown type as WebAdmin names it. */
export const taskTypeLabel = (t: TFunction, type: string): string =>
  TASK_TYPE_LABEL_KEYS[type] ? t(TASK_TYPE_LABEL_KEYS[type]) : type;

/** The first characters of a task ID, enough to tell tasks apart on screen. */
export const shortTaskId = (taskId: string) => taskId.slice(0, 8);

/** What a task worked on: a repository, a user, a domain (or one of its calendars), a mailbox. */
export type TaskTargetInfo =
  | { kind: "repository" | "user" | "mailbox"; value: string }
  | { kind: "domain"; value: string; calendar?: { type: "team-calendar" | "resource"; id: string } };

const stringOf = (value: unknown) => (typeof value === "string" && value ? value : undefined);

export function taskTargetInfo(task: TaskDetailResponse): TaskTargetInfo | null {
  const info = task.additionalInformation ?? {};
  const repository = stringOf(info.repositoryPath);
  if (repository) return { kind: "repository", value: repository };
  // A rename worked on the user it was started from
  const user = stringOf(info.targetUser) ?? stringOf(info.username) ?? stringOf(info.user) ?? stringOf(info.oldUser);
  if (user) return { kind: "user", value: user };
  const domain = stringOf(info.domain);
  if (domain) {
    const calendarId = stringOf(info.calendarId);
    const type = info.calendarType;
    return calendarId && (type === "team-calendar" || type === "resource")
      ? { kind: "domain", value: domain, calendar: { type, id: calendarId } }
      : { kind: "domain", value: domain };
  }
  const mailbox = stringOf(info.mailboxId);
  return mailbox ? { kind: "mailbox", value: mailbox } : null;
}

// "open-paas.org · team calendar": the kind of the calendar after its domain
const calendarSuffix = (t: TFunction, target: TaskTargetInfo) =>
  target.kind === "domain" && target.calendar ? ` · ${t(`tasks.targetCalendar.${target.calendar.type}`)}` : "";

const hasCalendarTarget = (task: TaskDetailResponse) => {
  const target = taskTargetInfo(task);
  return target?.kind === "domain" && !!target.calendar;
};

/** What a task worked on, as text: in headings and confirmations. */
export function taskTarget(t: TFunction, task: TaskDetailResponse): string | null {
  const target = taskTargetInfo(task);
  return target ? target.value + calendarSuffix(t, target) : null;
}

/** "Subscribe to all mailboxes — bob@example.com": the task named as the operator started it. */
export function taskHeading(t: TFunction, task: TaskDetailResponse): string {
  if (!task.type) return t("common.taskLink", { taskId: task.taskId });
  const target = taskTarget(t, task);
  const label = taskTypeLabel(t, task.type);
  return target ? `${label} — ${target}` : label;
}

/** The cancel confirmation, naming the task and its target rather than an ID alone. */
export function cancelConfirmMessage(t: TFunction, task: TaskDetailResponse): string {
  const target = taskTarget(t, task);
  return t("tasks.cancelConfirm", {
    name: taskTypeLabel(t, task.type),
    target: target ? t("tasks.cancelTarget", { target }) : "",
    taskId: task.taskId,
  });
}

// The name of the team calendar or resource a task worked on, when it can be read
function useCalendarName(domain: string, type: string | undefined, id: string | undefined, enabled: boolean): string | undefined {
  const canListTeamCalendars = useIsAllowed("GET", "/domains/{domain}/team-calendars");
  const canReadResource = useIsAllowed("GET", "/domains/{domain}/resources/{resourceId}");
  const fetchName = useCallback(async (): Promise<string | undefined> => {
    if (!id) return undefined;
    if (type === "team-calendar") {
      const found = (await getTeamCalendars(domain)).find((teamCalendar) => teamCalendar.id === id);
      return found ? found.displayName || found.name : undefined;
    }
    return (await getResource(domain, id)).name ?? undefined;
  }, [domain, type, id]);
  const allowed = type === "team-calendar" ? canListTeamCalendars : canReadResource;
  // A failed read, or a calendar removed since, leaves the target without a name
  const { data } = useFetchData(enabled && id && allowed ? fetchName : null);
  return data ?? undefined;
}

/**
 * The target of a task, linked to its page: a user, a domain, a resource. `withName` also reads
 * the name of the team calendar or resource, on the task page and in its dialog, not in the list.
 */
export function TaskTarget({ task, withName = false }: { task: TaskDetailResponse; withName?: boolean }) {
  const { t } = useTranslation();
  const target = taskTargetInfo(task);
  const calendar = target?.kind === "domain" ? target.calendar : undefined;
  const name = useCalendarName(target?.value ?? "", calendar?.type, calendar?.id, withName);
  if (!target) return null;
  if (target.kind === "user") return <UserLink address={target.value} />;
  if (target.kind !== "domain") return <>{target.value}</>;
  const domainPage = `/domains/domain/${encodeURIComponent(target.value)}`;
  return (
    <>
      <Link to={domainPage} className="text-blue-600 hover:underline">{target.value}</Link>
      {calendar && (
        <>
          {" · "}
          {calendar.type === "resource"
            ? <Link to={`${domainPage}/resource/${encodeURIComponent(calendar.id)}`} className="text-blue-600 hover:underline">{t("tasks.targetCalendar.resource")}</Link>
            : t("tasks.targetCalendar.team-calendar")}
          {name && ` ${name}`}
        </>
      )}
    </>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>
      {statusLabel(t, status)}
    </span>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <>
    <span className="text-gray-500 font-medium">{label}</span>
    <span className="min-w-0 break-words">{children}</span>
  </>
);

/** Status, type, dates, duration and where the task ran. */
export function TaskSummary({ task }: { task: TaskDetailResponse }) {
  const { t } = useTranslation();
  const took = duration(task);
  return (
    <div className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      <Row label={t("tasks.status")}><StatusPill status={task.status} /></Row>
      <Row label={t("tasks.type")}>
        {taskTypeLabel(t, task.type)}
        <span className="ml-2 font-mono text-xs text-gray-500">{task.type}</span>
      </Row>
      {/* The team calendar or resource a calendar task worked on, by its name; other targets are in the details */}
      {hasCalendarTarget(task) && <Row label={t("tasks.target")}><TaskTarget task={task} withName /></Row>}
      <Row label={t("tasks.submitted")}>{formatDate(task.submitDate)}</Row>
      <Row label={t("tasks.started")}>{formatDate(task.startedDate)}</Row>
      {task.failedDate ? <Row label={t("tasks.failedAt")}>{formatDate(task.failedDate)}</Row>
        : task.canceledDate ? <Row label={t("tasks.cancelledAt")}>{formatDate(task.canceledDate)}</Row>
        : <Row label={t("tasks.completed")}>{formatDate(task.completedDate)}</Row>}
      {took !== null && <Row label={t("tasks.duration")}>{formatDuration(t, took)}</Row>}
      {task.executedOn && <Row label={t("tasks.executedOn")}>{task.executedOn}</Row>}
      {task.submittedFrom && <Row label={t("tasks.submittedFrom")}>{task.submittedFrom}</Row>}
    </div>
  );
}

/** additionalInformation as labelled values, then the raw JSON on demand. */
export function TaskDetails({ task, raw }: { task: TaskDetailResponse; raw: unknown }) {
  const { t } = useTranslation();
  const entries = Object.entries(task.additionalInformation ?? {}).filter(([key, value]) => isDetailShown(key, value));
  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">{t("tasks.details")}</h2>
          <div className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
            {entries.map(([key, value]) => (
              <Fragment key={key}>
                <span className="text-gray-500 font-medium">{DETAIL_LABEL_KEYS[key] ? t(DETAIL_LABEL_KEYS[key]) : key}</span>
                {key === "timestamp" && typeof value === "string"
                  ? <span className="min-w-0 break-words">{formatDate(value)}</span>
                  : key === "calendarType" && typeof value === "string" && CALENDAR_TYPE_KEYS[value]
                  ? <span className="min-w-0 break-words">{t(CALENDAR_TYPE_KEYS[value])}</span>
                  : USER_KEYS.has(key) && typeof value === "string"
                  ? <span className="min-w-0"><UserLink address={value} /></span>
                  : <span className="min-w-0 break-words">{detailText(t, value)}</span>}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t("tasks.rawJson")}</summary>
        <pre className="mt-2 text-xs bg-gray-50 p-3 rounded overflow-x-auto">{JSON.stringify(raw, null, 2)}</pre>
      </details>
    </div>
  );
}
