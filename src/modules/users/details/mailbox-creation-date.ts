const UUID_V1_EPOCH_OFFSET = 122192928000000000n;

/** The creation instant encoded in a version 1 UUID mailbox id, or null when it is not one. */
export function uuidV1ToDate(uuid: string): Date | null {
  try {
    const parts = uuid.split("-");
    const timeHex = parts[2].slice(1) + parts[1] + parts[0];
    const timestamp100ns = BigInt("0x" + timeHex);
    const ms = Number((timestamp100ns - UUID_V1_EPOCH_OFFSET) / 10000n);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/** The mailbox creation date, in the given locale and the browser time zone, like the other dates of the console. */
export function formatMailboxCreationDate(uuid: string, locale: string | undefined): string | null {
  const date = uuidV1ToDate(uuid);
  if (!date) return null;
  return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
}
