// The restore of the deleted messages of a team mailbox: the task it schedules, and its command preview.

export const TEAM_MAILBOX_RESTORE_TASK_TYPE = "team-mailbox-deleted-messages-restore";

// No -d: WebAdmin restores everything and refuses any body
export const teamMailboxRestoreCommand = (domain: string, mailbox: string) =>
  `curl -XPOST '/deletedMessages/teamMailbox/${mailbox}@${domain}?action=restore'`;
