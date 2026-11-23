import { useEffect, useState } from "react";
import { getMailQueueNames } from "./api-client";

/** The mail queue names, or null while loading or when they cannot be listed (e.g. not allowed). */
export function useMailQueueNames(): string[] | null {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    let active = true;
    getMailQueueNames().then(
      (loaded) => { if (active) setNames(Array.isArray(loaded) ? loaded : null); },
      () => { if (active) setNames(null); }
    );
    return () => { active = false; };
  }, []);
  return names;
}

/** A typed queue missing from the listed ones: WebAdmin would refuse it with a 400. */
export const isUnknownQueue = (queue: string, knownQueues: string[] | null): boolean =>
  knownQueues !== null && queue.trim() !== "" && !knownQueues.includes(queue.trim());
