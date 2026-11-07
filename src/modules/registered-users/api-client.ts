import { apiClient } from "@/lib/apiClient";
import { RegisteredUser } from "./types";

// A domain administrator (DOMAIN mode, `domain` set) only ever calls the domain-scoped
// routes, whose errors are surfaced as they are. Never fall back to the global
// /registeredUsers routes: they span every tenant, and a fallback would lead operators to
// grant them to tenant-scoped administrators.
const scopedPath = (domain: string) => `/domains/${encodeURIComponent(domain)}/registeredUsers`;

export const getRegisteredUsers = async (domain?: string): Promise<RegisteredUser[]> =>
  apiClient.get(domain ? scopedPath(domain) : '/registeredUsers');

export const createRegisteredUser = async (user: RegisteredUser, domain?: string): Promise<void> =>
  apiClient.post(domain ? scopedPath(domain) : '/registeredUsers', user);

export const updateRegisteredUser = async (
  id: string,
  data: { email?: string; firstname?: string; lastname?: string },
  domain?: string,
): Promise<void> =>
  apiClient.patch(`${domain ? scopedPath(domain) : '/registeredUsers'}?id=${encodeURIComponent(id)}`, data);

export const deleteRegisteredUser = async (email: string, domain?: string): Promise<void> =>
  apiClient.delete(`${domain ? scopedPath(domain) : '/registeredUsers'}?email=${encodeURIComponent(email)}`);
