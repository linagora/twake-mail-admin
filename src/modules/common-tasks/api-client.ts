import { apiClient } from "@/lib/apiClient";
import { AdditionalParams, TaskDetailResponse, TaskRequest } from "./types";
import { appConfig } from "@/lib/config";

const parsePayloadToSearchParams = (payload: any) => {
  if (!payload) {
    return '';
  }

  const cleanedPayload: any = {};
  for (const key in payload) {
    if (payload[key]) {
      cleanedPayload[key] = payload[key]
    }
  }
  return new URLSearchParams(cleanedPayload).toString();
}

export const runMailBoxesTask = async (payload: TaskRequest, options?: any): Promise<any> => {
  const params = parsePayloadToSearchParams(payload);
  const response = await apiClient.post<any, any>(
    `/mailboxes?${params}`,
    {},
    {
      ...options,
    }
  );
  return response;
};

export const runMessageTask = async (payload: TaskRequest & AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams(payload);
  const response = await apiClient.post<any, any>(
    `/messages?${params}`
  );
  return response;
};

export const runQuotaTask = async (payload: TaskRequest & AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams(payload)
  const response = await apiClient.post<any, any>(
    `/quota/users?${params}`
  );
  return response;
};

export const runFixMappingTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams(payload);
  const response = await apiClient.post<any, any>(
    `/cassandra/mappings?action=SolveInconsistencies?${params}`
  );
  return response;
};

export const runCleanupJmapUploadsTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams(payload);
  const response = await apiClient.delete<any, any>(
    `/jmap/uploads?scope=expired?${params}`
  );
  return response;
}

export const runBlobGarbageCollectionTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams(payload);
  const response = await apiClient.delete<any, any>(
    `/blobs?scope=unreferenced?${params}`
  );
  return response;
}

export const runPurgeDeletedMessagesTask = async (): Promise<any> => {
  const response = await apiClient.delete<any, any>(
    `/deletedMessages?scope=expired`
  );
  return response;
}

export const runPopulateEmailQueryViewTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams({ task: 'populateEmailQueryView', ...payload });
  return apiClient.post<any, any>(`/mailboxes?${params}`);
}

export const reloadCertificates = async (port?: string): Promise<void> => {
  const query = new URLSearchParams({ "reload-certificate": "" });
  if (port) query.set("port", port);
  await apiClient.post(`/servers?${query.toString()}`);
};

export const cleanupMailbox = async (
  mailbox: "Trash" | "Spam",
  olderThan: string
): Promise<any> => {
  const query = new URLSearchParams({ olderThan, mailbox, useSavedDate: "" });
  return apiClient.delete(`/messages?${query.toString()}`);
};

export const cleanupOldTasks = async (olderThanDays: number): Promise<any> => {
  return apiClient.delete(`/tasks?olderThan=${olderThanDays}day`);
};

export const repositionTeamMailboxSystemRights = async (): Promise<void> => {
  await apiClient.post(`/team-mailboxes?action=repositionSystemRights`);
};

// ---------------------------------------------------------------------------
// Calendar-specific task runners
// ---------------------------------------------------------------------------

export const runImportLdapUsersTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams({ task: 'importFromLDAP', ...payload });
  return apiClient.post<any, any>(`/registeredUsers/tasks?${params}`);
};

export const runDomainMemberSyncTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams({ task: 'sync', ...payload });
  return apiClient.post<any, any>(`/addressbook/domain-members?${params}`);
};

export const runCalendarEventReindexTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams({ task: 'reindex', ...payload });
  return apiClient.post<any, any>(`/calendars?${params}`);
};

export const runCalendarEventArchivalTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams({ task: 'archive', ...payload });
  return apiClient.post<any, any>(`/calendars?${params}`);
};

export const runAlarmReschedulingTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams({ task: 'scheduleAlarms', ...payload });
  return apiClient.post<any, any>(`/calendars?${params}`);
};

export const runAddMissingFieldsTask = async (): Promise<any> => {
  return apiClient.post<any, any>(`/registeredUsers?action=addMissingFields`);
};

export const runClearDomainMembersContactsTask = async (payload?: AdditionalParams): Promise<any> => {
  const params = parsePayloadToSearchParams(payload);
  return apiClient.delete<any, any>(`/addressbook/domain-members${params ? `?${params}` : ''}`);
};

// In DOMAIN mode, try domain-scoped task route first; fall back to global on 404.
// No session cache — 404 here means "task not owned by this domain", not a backend capability gap.
async function callTaskRoute<T>(
  domain: string | undefined,
  domainScopedFn: () => Promise<T>,
  globalFn: () => Promise<T>,
): Promise<T> {
  if (appConfig.mode !== 'DOMAIN' || !domain) return globalFn();
  try {
    return await domainScopedFn();
  } catch (err: any) {
    if (err?.response?.status === 404) return globalFn();
    throw err;
  }
}

export const getTaskDetail = async (id: string, domain?: string): Promise<TaskDetailResponse> =>
  callTaskRoute(
    domain,
    () => apiClient.get(`/domains/${encodeURIComponent(domain!)}/tasks/${encodeURIComponent(id)}`),
    () => apiClient.get(`/tasks/${encodeURIComponent(id)}`),
  );

export const cancelTask = async (id: string, domain?: string): Promise<any> =>
  callTaskRoute(
    domain,
    () => apiClient.delete(`/domains/${encodeURIComponent(domain!)}/tasks/${encodeURIComponent(id)}`),
    () => apiClient.delete(`/tasks/${encodeURIComponent(id)}`),
  );
