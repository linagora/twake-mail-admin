import { apiClient } from "@/lib/apiClient";
import { CreateMailingListRequest, MailingListAddresses, MailingListDetail } from "./types";

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

export const createMailingList = async (
  address: string,
  request: CreateMailingListRequest
): Promise<void> => {
  await apiClient.put(`/mailingLists/${encodeURIComponent(address)}`, request);
};

export const deleteMailingList = async (address: string): Promise<void> => {
  await apiClient.delete(`/mailingLists/${encodeURIComponent(address)}`);
};

export const addMailingListMember = async (
  address: string,
  member: string
): Promise<void> => {
  await apiClient.put(
    `/mailingLists/${encodeURIComponent(address)}/members/${encodeURIComponent(member)}`
  );
};

export const removeMailingListMember = async (
  address: string,
  member: string
): Promise<void> => {
  await apiClient.delete(
    `/mailingLists/${encodeURIComponent(address)}/members/${encodeURIComponent(member)}`
  );
};

export const addMailingListOwner = async (
  address: string,
  owner: string
): Promise<void> => {
  await apiClient.put(
    `/mailingLists/${encodeURIComponent(address)}/owners/${encodeURIComponent(owner)}`
  );
};

export const removeMailingListOwner = async (
  address: string,
  owner: string
): Promise<void> => {
  await apiClient.delete(
    `/mailingLists/${encodeURIComponent(address)}/owners/${encodeURIComponent(owner)}`
  );
};
