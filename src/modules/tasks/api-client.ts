import { apiClient } from "@/lib/apiClient";
import { TaskDetailResponse } from "@/modules/common-tasks/types";

export interface ListTasksParams {
  status?: string;
  type?: string;
  submittedBefore?: string;
  submittedAfter?: string;
  startedBefore?: string;
  startedAfter?: string;
  completedBefore?: string;
  completedAfter?: string;
  failedBefore?: string;
  failedAfter?: string;
  offset?: number;
  limit?: number;
}

export const listTasks = async (params?: ListTasksParams): Promise<TaskDetailResponse[]> => {
  const query = new URLSearchParams();
  if (params) {
    if (params.status) query.set("status", params.status);
    if (params.type) query.set("type", params.type);
    if (params.submittedBefore) query.set("submittedBefore", params.submittedBefore);
    if (params.submittedAfter) query.set("submittedAfter", params.submittedAfter);
    if (params.startedBefore) query.set("startedBefore", params.startedBefore);
    if (params.startedAfter) query.set("startedAfter", params.startedAfter);
    if (params.completedBefore) query.set("completedBefore", params.completedBefore);
    if (params.completedAfter) query.set("completedAfter", params.completedAfter);
    if (params.failedBefore) query.set("failedBefore", params.failedBefore);
    if (params.failedAfter) query.set("failedAfter", params.failedAfter);
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
  }
  const qs = query.toString();
  return apiClient.get(`/tasks${qs ? `?${qs}` : ""}`);
};
