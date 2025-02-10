import { apiClient } from "@/lib/apiClient";
import { TaskDetailResponse, TaskRequest } from "./types";

export const runMailBoxesTask = async (payload: TaskRequest, options?: any): Promise<any> => {
  const params = new URLSearchParams(payload).toString();
  const response = await apiClient.post<any, any>(
    `/mailboxes?${params}`,
    {},
    {
      ...options,
    }
  );
  return response;
};

export const runMessageTask = async (payload: TaskRequest): Promise<any> => {
  const params = new URLSearchParams(payload).toString();
  const response = await apiClient.post<any, any>(
    `/messages?${params}`
  );
  return response;
};

export const runQuotaTask = async (payload: TaskRequest): Promise<any> => {
  const params = new URLSearchParams(payload).toString()
  const response = await apiClient.post<any, any>(
    `/quota/users?${params}`
  );
  return response;
};

export const runFixMappingTask = async (): Promise<any> => {
  const response = await apiClient.post<any, any>(
    '/cassandra/mappings?action=SolveInconsistencies'
  );
  return response;
};

export const runCleanupJmapUploadsTask = async (): Promise<any> => {
  const response = await apiClient.delete<any, any>(
    '/jmap/uploads?scope=expired'
  );
  return response;
}

export const runBlobGarbageCollectionTask = async (): Promise<any> => {
  const response = await apiClient.delete<any, any>(
    '/blobs?scope=unreferenced'
  );
  return response;
}

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
