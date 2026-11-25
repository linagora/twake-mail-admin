import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Removing messages (clearing or deleting a mailbox) changes the quota usage: the Quota section
// reads the shared revision to refetch it, and the summary strip follows the section.
export interface UserQuotaRevision {
  revision: number;
  notifyQuotaChanged: () => void;
}

export const UserQuotaRevisionContext = createContext<UserQuotaRevision | null>(null);

export function useUserQuotaRevisionState(): UserQuotaRevision {
  const [revision, setRevision] = useState(0);
  const notifyQuotaChanged = useCallback(() => setRevision((current) => current + 1), []);
  return useMemo(() => ({ revision, notifyQuotaChanged }), [revision, notifyQuotaChanged]);
}

// Falls back to a section-local revision when rendered outside the user detail page.
export function useUserQuotaRevision(): UserQuotaRevision {
  const shared = useContext(UserQuotaRevisionContext);
  const local = useUserQuotaRevisionState();
  return shared ?? local;
}
