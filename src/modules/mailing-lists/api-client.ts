import { apiClient } from "@/lib/apiClient";
import { MailingListAddresses, MailingListDetail } from "./types";

export const getMailingLists = async (
  domain?: string
): Promise<MailingListAddresses> => {
  return apiClient.get<any, MailingListAddresses>(
    "/mailingLists",
    domain ? { params: { domain } } : undefined
  );
};

export const getMailingListDetail = async (
  address: string
): Promise<MailingListDetail> => {
  return apiClient.get<any, MailingListDetail>(
    `/mailingLists/${encodeURIComponent(address)}`
  );
};
