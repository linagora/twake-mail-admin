import { apiClient, getRaw } from "@/lib/apiClient";
import { UnsentMailId, UnsentMail, TaskResponse } from "./types";

export const getUnsentMailIds = async (
  sender?: string,
  recipient?: string,
  limit?: number
): Promise<UnsentMailId[]> => {
  const params = new URLSearchParams();
  if (sender) params.append("sender", sender);
  if (recipient) params.append("recipient", recipient);
  if (limit) params.append("limit", String(limit));
  const query = params.toString();
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
  sender?: string,
  recipient?: string,
  limit?: number
): Promise<TaskResponse> => {
  const params = new URLSearchParams({ action: "resend" });
  if (sender) params.append("sender", sender);
  if (recipient) params.append("recipient", recipient);
  if (limit) params.append("limit", String(limit));
  return apiClient.post<any, TaskResponse>(`/unsentMails?${params.toString()}`);
};

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
