/**
 * A mailbox path as James serializes it, "#private:charlotte@example.com:INBOX": its owner
 * and its name; null when the path is not of a user's private namespace.
 */
export function parseMailboxPath(path: string): { owner: string; mailbox: string } | null {
  const match = /^#private:([^:]+):(.*)$/.exec(path);
  return match ? { owner: match[1], mailbox: match[2] } : null;
}

const HIERARCHY_DELIMITER = ".";

const NAMESPACE_PREFIX = "#";

/** Why WebAdmin would refuse a folder name. */
export type FolderNameProblem = "emptyPart" | "namespacePrefix";

/**
 * Why WebAdmin refuses this folder name, or null when it accepts it: every part between the "."
 * hierarchy delimiters has to be named, so "a..b", ".a" and "a." are refused just like an empty
 * name, and no part may start with "#", the prefix of the IMAP namespaces such as "#user".
 */
export function folderNameProblem(name: string): FolderNameProblem | null {
  const parts = name.split(HIERARCHY_DELIMITER);
  if (parts.some((part) => part.length === 0)) return "emptyPart";
  if (parts.some((part) => part.startsWith(NAMESPACE_PREFIX))) return "namespacePrefix";
  return null;
}

/**
 * The folders provisioned with every team mailbox: WebAdmin refuses to delete them.
 */
const TEAM_MAILBOX_SYSTEM_FOLDERS: ReadonlySet<string> = new Set(["INBOX", "Sent", "Trash", "Outbox", "Drafts", "Templates"]);

/**
 * Whether this folder, its path relative to the team mailbox root, is one of the top-level
 * system folders WebAdmin refuses to delete; "INBOX.work" is not.
 */
export function isTeamMailboxSystemFolder(folderName: string): boolean {
  return TEAM_MAILBOX_SYSTEM_FOLDERS.has(folderName);
}
