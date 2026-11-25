import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";

/**
 * Whether the domain of a domain page is managed: WebAdmin answers 204 or 404 to
 * HEAD /domains/{domain}. Like the account check of the user page, the request is not gated and
 * any other answer (refused, network or server error) is "unknown", where the page renders as
 * usual rather than hiding data on a transient failure.
 */
export type DomainState = "checking" | "exists" | "missing" | "unknown";

export function useDomainState(domain: string): DomainState {
  const [state, setState] = useState<DomainState>("checking");

  useEffect(() => {
    let cancelled = false;
    setState("checking");
    apiClient.head(`/domains/${encodeURIComponent(domain)}`)
      .then(() => { if (!cancelled) setState("exists"); })
      .catch((err) => {
        if (!cancelled) setState(err?.response?.status === 404 ? "missing" : "unknown");
      });
    return () => { cancelled = true; };
  }, [domain]);

  return state;
}
