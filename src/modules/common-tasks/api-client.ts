import { apiClient } from "@/lib/apiClient";
import { AdditionalParams, TaskDetailResponse, TaskRequest } from "./types";

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

export const reloadCertificates = async (port?: string): Promise<void> => {
  const query = new URLSearchParams({ "reload-certificate": "" });
  if (port) query.set("port", port);
  await apiClient.post(`/servers?${query.toString()}`);
};

export const cleanupOldTasks = async (olderThanDays: number): Promise<any> => {
  return apiClient.delete(`/tasks?olderThan=${olderThanDays}day`);
};

export const getTaskDetail = async (id: string): Promise<TaskDetailResponse> => {
  const response = await apiClient.get<any, TaskDetailResponse>(
    `/tasks/${id}`
  );
  return response;
}

export const cancelTask = async (id: string): Promise<any> => {
  const response = await apiClient.delete<any, any>(
    `/tasks/${id}`
  );
  return response;
}
