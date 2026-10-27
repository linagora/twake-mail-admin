// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { cancelConfirmMessage, shortTaskId, TASK_TYPE_LABEL_KEYS, taskHeading, taskName, taskTargetInfo, taskTypeLabel } from "./task-summary";
import en from "@/i18n/locales/en.json";
import { TaskDetailResponse } from "@/modules/common-tasks/types";

// Returns the key and its options, to see what is said
const t = ((key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key)) as unknown as TFunction;
const task = (type: string, additionalInformation: Record<string, unknown> = {}) =>
  ({ taskId: "58ae73fa-5585-417c-b320-1c19667b4743", type, status: "inProgress", additionalInformation }) as unknown as TaskDetailResponse;

describe("task names", () => {
  it("names a known type as the button that starts it, an unknown one as WebAdmin does", () => {
    expect(taskTypeLabel(t, "SubscribeAllTask")).toBe("users.tasks.subscribeAll");
    expect(taskTypeLabel(t, "recompute-mailbox-counters")).toBe("commonTasks.recomputeMailboxCounters");
    expect(taskTypeLabel(t, "brand-new-task")).toBe("brand-new-task");
  });

  it("has an English name for every type it knows", () => {
    const lookup = (key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
    const missing = Object.entries(TASK_TYPE_LABEL_KEYS).filter(([, key]) => typeof lookup(key) !== "string");
    expect(missing).toEqual([]);
  });

  // The types WebAdmin reported for each task started from the console, in the QA stacks
  it.each([
    // Mail
    "full-reindexing", "solve-message-inconsistencies", "recompute-mailbox-counters", "recompute-current-quotas",
    "cassandra-mappings-solve-inconsistencies", "UploadRepositoryCleanupTask", "ContactIndexing", "PopulateEmailQueryViewTask",
    "tmail-deleted-messages-blob-store-based-garbage-collection", "ExpireMailboxTask", "tasks-cleanup",
    "user-reindexing", "SubscribeAllTask", "RecomputeUserFastViewProjectionItemsTask", "deleted-messages-restore",
    "UsernameChangeTask", "DeleteUserDataTask", "UserDataTieringTask", "UserTemplatesProvisionTask", "ClearMailboxContentTask",
    "DomainTemplatesProvisionTask", "DeleteUsersDataOfDomainTask",
    "reprocessing-all", "clear-mail-repository", "event-dead-letters-redeliver-group",
    "twake-space-purge", "twake-space-reindex",
    // Calendar
    "reindex-calendar-events", "schedule-alarms", "add-missing-fields", "calendar-archival", "calendar-import",
    "addressbook-import", "domain-calendar-import", "resend-unsent-mails", "delete-unsent-mails",
  ])("names %s", (type) => {
    expect(taskTypeLabel(t, type)).not.toBe(type);
  });

  it("heads a task with its name and its target", () => {
    expect(taskHeading(t, task("SubscribeAllTask", { username: "bob@example.com" }))).toBe("users.tasks.subscribeAll — bob@example.com");
    expect(taskHeading(t, task("BlobGCTask"))).toBe("commonTasks.blobGarbageCollection");
  });

  it("names the task and its target before cancelling it", () => {
    const message = cancelConfirmMessage(t, task("user-reindexing", { username: "bob@example.com" }));
    expect(message).toContain('"name":"users.tasks.reindexAll"');
    expect(message).toContain("tasks.cancelTarget");
    expect(message).toContain("58ae73fa-5585-417c-b320-1c19667b4743");
  });

  it("shortens a task ID to its first 8 characters", () => {
    expect(shortTaskId("58ae73fa-5585-417c-b320-1c19667b4743")).toBe("58ae73fa");
  });
});

describe("task targets", () => {
  it("reads the user of a calendar archival and the calendar of an import", () => {
    expect(taskHeading(t, task("calendar-archival", { targetUser: "alice@open-paas.org" }))).toBe("commonTasks.calendarEventArchival — alice@open-paas.org");
    expect(taskTargetInfo(task("domain-calendar-import", { domain: "open-paas.org", calendarType: "team-calendar", calendarId: "6adc" })))
      .toEqual({ kind: "domain", value: "open-paas.org", calendar: { type: "team-calendar", id: "6adc" } });
    expect(taskHeading(t, task("domain-calendar-import", { domain: "open-paas.org", calendarType: "resource", calendarId: "r1" })))
      .toBe("users.calendars.importTitle — open-paas.org · tasks.targetCalendar.resource");
  });

  it("keeps the mail targets", () => {
    expect(taskTargetInfo(task("x", { repositoryPath: "var/mail/error", username: "bob@example.com" }))).toEqual({ kind: "repository", value: "var/mail/error" });
    expect(taskTargetInfo(task("x", { mailboxId: "42" }))).toEqual({ kind: "mailbox", value: "42" });
  });

  it("names a Trash or Spam cleanup after its folder, and its user from its options", () => {
    const expire = (runningOptions: Record<string, unknown>) =>
      task("ExpireMailboxTask", { mailboxesExpired: 0, messagesDeleted: 0, runningOptions });
    const ofBob = expire({ usersPerSecond: 1, mailbox: "Trash", useSavedDate: true, user: "bob@example.com", olderThan: "5d" });
    expect(taskTargetInfo(ofBob)).toEqual({ kind: "user", value: "bob@example.com" });
    expect(taskHeading(t, ofBob)).toBe("users.tasks.cleanupTrash — bob@example.com");
    expect(taskHeading(t, expire({ mailbox: "Trash", user: null, olderThan: "5d" }))).toBe("commonTasks.cleanupTrashAll");
    expect(taskName(t, expire({ mailbox: "Spam", user: null }))).toBe("commonTasks.cleanupSpamAll");
    expect(taskName(t, expire({ mailbox: "Archive", user: null }))).toBe("taskTypes.expireMailbox");
  });

  it("names a rename after the user it was started from", () => {
    expect(taskTargetInfo(task("UsernameChangeTask", { oldUser: "bob@example.com", newUser: "robert@example.com" })))
      .toEqual({ kind: "user", value: "bob@example.com" });
  });
});
