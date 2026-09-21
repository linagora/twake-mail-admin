import { apiClient, getRaw } from "@/lib/apiClient";
import { UnsentMailId, UnsentMail, UnsentMailFilters, TaskResponse } from "./types";

/** The listing, the resend task and the delete task share the same selection. */
const withFilters = (
  params: URLSearchParams,
  { sender, recipient, limit }: UnsentMailFilters
): URLSearchParams => {
  if (sender) params.append("sender", sender);
  if (recipient) params.append("recipient", recipient);
  if (limit) params.append("limit", String(limit));
  return params;
};

const planUnsentMailsTask = async (
  action: "resend" | "delete",
  filters: UnsentMailFilters
): Promise<TaskResponse> => {
  const params = withFilters(new URLSearchParams({ action }), filters);
  return apiClient.post<any, TaskResponse>(`/unsentMails?${params.toString()}`);
};

export const getUnsentMailIds = async (
  filters: UnsentMailFilters = {}
): Promise<UnsentMailId[]> => {
  const query = withFilters(new URLSearchParams(), filters).toString();
  return apiClient.get<any, UnsentMailId[]>(
    `/unsentMails${query ? `?${query}` : ""}`
  );
};

export const getUnsentMail = async (id: string): Promise<UnsentMail> =>
  apiClient.get<any, UnsentMail>(`/unsentMails/${encodeURIComponent(id)}`);

export const deleteUnsentMail = async (id: string): Promise<void> => {
  await apiClient.delete(`/unsentMails/${encodeURIComponent(id)}`);
};

export const resendAllUnsentMails = async (
  filters: UnsentMailFilters = {}
): Promise<TaskResponse> => planUnsentMailsTask("resend", filters);

export const deleteAllUnsentMails = async (
  filters: UnsentMailFilters = {}
): Promise<TaskResponse> => planUnsentMailsTask("delete", filters);

export const resendUnsentMail = async (id: string): Promise<TaskResponse> => {
  return apiClient.post<any, TaskResponse>(
    `/unsentMails/${encodeURIComponent(id)}?action=resend`
  );
};

export async function downloadUnsentMail(id: string): Promise<void> {
  const response = await getRaw<Blob>(`/unsentMails/${encodeURIComponent(id)}`, {
    headers: { Accept: "message/rfc822" },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${id}.eml`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
