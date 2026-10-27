/**
 * A mailbox path as James serializes it, "#private:charlotte@example.com:INBOX": its owner
 * and its name; null when the path is not of a user's private namespace.
 */
export function parseMailboxPath(path: string): { owner: string; mailbox: string } | null {
  const match = /^#private:([^:]+):(.*)$/.exec(path);
  return match ? { owner: match[1], mailbox: match[2] } : null;
}

const HIERARCHY_DELIMITER = ".";

/**
 * Whether WebAdmin accepts this folder name: every part between the "." hierarchy delimiters
 * has to be named, so "a..b", ".a" and "a." are refused just like an empty name.
 */
export function isValidFolderName(name: string): boolean {
  return name.split(HIERARCHY_DELIMITER).every((part) => part.length > 0);
}
