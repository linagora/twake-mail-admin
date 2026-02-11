import { apiClient } from "@/lib/apiClient";
import { NetworkChannel } from "./types";

export const getAllChannels = async (): Promise<NetworkChannel[]> => {
  const response = await apiClient.get<any, NetworkChannel[]>("/servers/channels");
  return response;
};

export const disconnectAllChannels = async (): Promise<void> => {
  await apiClient.delete("/servers/channels");
};
