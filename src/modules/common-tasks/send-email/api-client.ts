import { apiClient } from "@/lib/apiClient";

export const MAIL_TRANSFER_SERVICE = "/mail-transfer-service";

export const SEND_EMAIL_COMMAND =
  `curl -XPOST ${MAIL_TRANSFER_SERVICE} -H "Content-Type: message/rfc822" --data-binary @email.eml`;

/** Enqueues the message for processing, to the recipients its headers name. WebAdmin answers 201, or 400 on an invalid message. */
export const sendEmail = async (message: string): Promise<void> => {
  await apiClient.post(MAIL_TRANSFER_SERVICE, message, { headers: { "Content-Type": "message/rfc822" } });
};
