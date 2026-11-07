import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useDomain } from "@/modules/domain-admin/domain-context";

export interface RegisteredUsersPermissions {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

// What the current administrator may do on registered users, asked about the routes the
// console actually calls (see api-client.ts). A domain administrator only ever uses the
// domain-scoped routes: the global /registeredUsers routes span every tenant, so a profile
// must never have to grant them for these controls to show up in DOMAIN mode.
export function useRegisteredUsersPermissions(): RegisteredUsersPermissions {
  const domain = useDomain();
  const global = {
    read: useIsAllowed("GET", "/registeredUsers"),
    create: useIsAllowed("POST", "/registeredUsers"),
    edit: useIsAllowed("PATCH", "/registeredUsers"),
    delete: useIsAllowed("DELETE", "/registeredUsers"),
  };
  const scoped = {
    read: useIsAllowed("GET", "/domains/{domain}/registeredUsers"),
    create: useIsAllowed("POST", "/domains/{domain}/registeredUsers"),
    edit: useIsAllowed("PATCH", "/domains/{domain}/registeredUsers"),
    delete: useIsAllowed("DELETE", "/domains/{domain}/registeredUsers"),
  };
  return domain ? scoped : global;
}
