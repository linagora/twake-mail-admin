import { apiClient } from "@/lib/apiClient";

export interface MailboxResult {
  mailboxId: string;
  mailboxPath: string;
}

export interface MessageResult {
  mailboxes: MailboxResult[];
}

export const lookupMailbox = async (mailboxId: string): Promise<MailboxResult> => {
  return apiClient.get(`/mailboxes/${encodeURIComponent(mailboxId)}`);
};

export const lookupMessage = async (messageId: string): Promise<MessageResult> => {
  return apiClient.get(`/messages/${encodeURIComponent(messageId)}`);
};
