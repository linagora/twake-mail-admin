import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Aliases, forwards and mapping sources are all stored as mappings: a change made from one section
// also affects the others (Aliases, Forwards, Mappings, Allowed From Headers, JMAP Identities).
// Sections read the shared revision to refetch their data, and notify after each mapping change.
export interface UserMappingsRevision {
  revision: number;
  notifyMappingsChanged: () => void;
}

export const UserMappingsRevisionContext = createContext<UserMappingsRevision | null>(null);

export function useUserMappingsRevisionState(): UserMappingsRevision {
  const [revision, setRevision] = useState(0);
  const notifyMappingsChanged = useCallback(() => setRevision((current) => current + 1), []);
  return useMemo(() => ({ revision, notifyMappingsChanged }), [revision, notifyMappingsChanged]);
}

// Falls back to a section-local revision when rendered outside the user detail page.
export function useUserMappingsRevision(): UserMappingsRevision {
  const shared = useContext(UserMappingsRevisionContext);
  const local = useUserMappingsRevisionState();
  return shared ?? local;
}
