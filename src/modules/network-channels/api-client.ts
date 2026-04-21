import { apiClient } from "@/lib/apiClient";
import { NetworkChannel, ChannelQueryParams } from "./types";

export const getAllChannels = async (params?: ChannelQueryParams): Promise<NetworkChannel[]> => {
  const query = new URLSearchParams();
  if (params?.limit != null)       query.set("limit",         String(params.limit));
  if (params?.offset != null)      query.set("offset",        String(params.offset));
  if (params?.sortBy)              query.set("sortBy",        params.sortBy);
  if (params?.sortDirection)       query.set("sortDirection", params.sortDirection);
  if (params?.sortType)            query.set("sortType",      params.sortType);
  const qs = query.toString();
  return apiClient.get<any, NetworkChannel[]>(`/servers/channels${qs ? `?${qs}` : ""}`);
};

export const disconnectAllChannels = async (): Promise<void> => {
  await apiClient.delete("/servers/channels");
};
