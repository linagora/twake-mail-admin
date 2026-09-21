import { apiClient, getRaw } from "@/lib/apiClient";
import {
  UnsentMailId,
  UnsentMail,
  UnsentMailSelection,
  TaskResponse,
} from "./types";

/** The selection the listing, resend and delete routes all share. */
export const unsentMailSelectionParams = (
  { sender, recipient, limit }: UnsentMailSelection = {},
  base?: Record<string, string>
): URLSearchParams => {
  const params = new URLSearchParams(base);
  if (sender) params.append("sender", sender);
  if (recipient) params.append("recipient", recipient);
  if (limit) params.append("limit", String(limit));
  return params;
};

export const getUnsentMailIds = async (
  selection?: UnsentMailSelection
): Promise<UnsentMailId[]> => {
  const query = unsentMailSelectionParams(selection).toString();
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
  selection?: UnsentMailSelection
): Promise<TaskResponse> => {
  const params = unsentMailSelectionParams(selection, { action: "resend" });
  return apiClient.post<any, TaskResponse>(`/unsentMails?${params.toString()}`);
};

export const deleteAllUnsentMails = async (
  selection?: UnsentMailSelection
): Promise<TaskResponse> => {
  const params = unsentMailSelectionParams(selection, { action: "delete" });
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
