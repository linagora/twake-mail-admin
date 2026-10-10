// Conversions between ISO-8601 instants and the value of an <input type="datetime-local">,
// which is a wall-clock time ("YYYY-MM-DDTHH:mm") in the browser time zone.

const pad = (n: number) => String(n).padStart(2, "0");

export function isoToDatetimeLocal(isoValue: string | undefined): string {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function datetimeLocalToIso(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}
