import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { isWellFormedUsername } from "@/hooks/use-check-user-exists";

/**
 * Whether the address of a user page is an account: "missing" (404) and "invalid" (400) are
 * told apart from "unknown" (refused, network or server error), where the page renders as
 * usual rather than hiding data on a transient failure. Like the other existence checks,
 * the HEAD request is not gated: a refusal only leaves the page as it was. A name no account can
 * have (spaces, several "@") is invalid without asking: WebAdmin answers 404 to some of them.
 */
export type AccountState = "checking" | "exists" | "missing" | "invalid" | "unknown";

export function useAccountState(username: string): AccountState {
  const [state, setState] = useState<AccountState>("checking");

  useEffect(() => {
    if (!isWellFormedUsername(username)) {
      setState("invalid");
      return;
    }
    let cancelled = false;
    setState("checking");
    apiClient.head(`/users/${encodeURIComponent(username)}`)
      .then(() => { if (!cancelled) setState("exists"); })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        setState(status === 404 ? "missing" : status === 400 ? "invalid" : "unknown");
      });
    return () => { cancelled = true; };
  }, [username]);

  return state;
}
