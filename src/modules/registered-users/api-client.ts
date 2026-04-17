import { apiClient } from "@/lib/apiClient";
import { appConfig } from "@/lib/config";
import { RegisteredUser } from "./types";

// ---------------------------------------------------------------------------
// Fallback probe — DOMAIN mode only, cached per session.
// ---------------------------------------------------------------------------

// null = not yet probed | 'domain' = domain-scoped route | 'global' = global route
let registeredUsersRouting: 'domain' | 'global' | null = null;

async function withRegisteredUsersApiFallback<T>(
  domainScopedFn: () => Promise<T>,
  globalFn: () => Promise<T>,
): Promise<T> {
  // GLOBAL mode always uses global routes.
  if (appConfig.mode !== 'DOMAIN') return globalFn();

  // Routing already determined for this session — call directly, no fallback.
  if (registeredUsersRouting === 'domain') return domainScopedFn();
  if (registeredUsersRouting === 'global') return globalFn();

  // First call in DOMAIN mode: probe the domain-scoped route.
  try {
    const result = await domainScopedFn();
    registeredUsersRouting = 'domain';
    return result;
  } catch (err: any) {
    const status: number | undefined = err?.response?.status;
    if (status !== undefined && status >= 400 && status < 500) {
      registeredUsersRouting = 'global';
      return globalFn();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// API functions — domain param used in DOMAIN mode for scoped routes.
// ---------------------------------------------------------------------------

export const getRegisteredUsers = async (domain?: string): Promise<RegisteredUser[]> =>
  withRegisteredUsersApiFallback(
    () => apiClient.get(`/domains/${encodeURIComponent(domain!)}/registeredUsers`),
    () => apiClient.get('/registeredUsers'),
  );

export const createRegisteredUser = async (user: RegisteredUser, domain?: string): Promise<void> =>
  withRegisteredUsersApiFallback(
    () => apiClient.post(`/domains/${encodeURIComponent(domain!)}/registeredUsers`, user),
    () => apiClient.post('/registeredUsers', user),
  );

export const updateRegisteredUser = async (
  id: string,
  data: { email?: string; firstname?: string; lastname?: string },
  domain?: string,
): Promise<void> =>
  withRegisteredUsersApiFallback(
    () => apiClient.patch(`/domains/${encodeURIComponent(domain!)}/registeredUsers?id=${encodeURIComponent(id)}`, data),
    () => apiClient.patch(`/registeredUsers?id=${encodeURIComponent(id)}`, data),
  );
