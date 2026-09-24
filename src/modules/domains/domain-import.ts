/**
 * Bulk import of domains from a text file: one domain per line (LF or CRLF),
 * `#` and `//` start a comment running to the end of the line, blank lines and
 * comment-only lines are skipped.
 */
import axios from "axios";

const COMMENT = /(#|\/\/).*$/;

export interface ImportFailure {
  domain: string;
  reason: string;
}

export interface ImportProgress {
  created: number;
  alreadyExisting: number;
  failures: ImportFailure[];
  processed: number;
  total: number;
}

export function parseDomainList(content: string): string[] {
  const domains = content
    .split(/\r?\n/)
    .map((line) => line.replace(COMMENT, "").trim())
    .filter((line) => line.length > 0);
  return [...new Set(domains)];
}

/**
 * Creates, one after the other, the domains missing from `existing`, reporting
 * the counters after each of them so that the caller can display them live.
 */
export async function importDomains(
  domains: string[],
  existing: string[],
  createDomain: (domain: string) => Promise<void>,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportProgress> {
  const known = new Set(existing.map((domain) => domain.toLowerCase()));
  const initial: ImportProgress = { created: 0, alreadyExisting: 0, failures: [], processed: 0, total: domains.length };

  return domains.reduce<Promise<ImportProgress>>(async (previous, domain) => {
    const progress = advance(await previous, await importDomain(domain, known, createDomain));
    onProgress(progress);
    return progress;
  }, Promise.resolve(initial));
}

type Outcome = "created" | "alreadyExisting" | ImportFailure;

async function importDomain(
  domain: string,
  known: Set<string>,
  createDomain: (domain: string) => Promise<void>
): Promise<Outcome> {
  if (known.has(domain.toLowerCase())) return "alreadyExisting";
  try {
    await createDomain(domain);
    return "created";
  } catch (err) {
    return { domain, reason: failureReason(err) };
  }
}

function advance(progress: ImportProgress, outcome: Outcome): ImportProgress {
  const next = { ...progress, processed: progress.processed + 1 };
  if (outcome === "created") return { ...next, created: next.created + 1 };
  if (outcome === "alreadyExisting") return { ...next, alreadyExisting: next.alreadyExisting + 1 };
  return { ...next, failures: [...next.failures, outcome] };
}

function failureReason(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const details = err.response?.data?.details ?? err.response?.data?.message;
    return details ? `${err.response?.status}: ${details}` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
