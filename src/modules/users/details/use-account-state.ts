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
  // The answer for the username it was asked for: another username is checked anew
  const [answer, setAnswer] = useState<{ username: string; state: AccountState } | null>(null);
  const wellFormed = isWellFormedUsername(username);

  useEffect(() => {
    if (!wellFormed) return;
    let cancelled = false;
    apiClient.head(`/users/${encodeURIComponent(username)}`)
      .then(() => { if (!cancelled) setAnswer({ username, state: "exists" }); })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        setAnswer({ username, state: status === 404 ? "missing" : status === 400 ? "invalid" : "unknown" });
      });
    return () => { cancelled = true; };
  }, [username, wellFormed]);

  if (!wellFormed) return "invalid";
  return answer?.username === username ? answer.state : "checking";
}
