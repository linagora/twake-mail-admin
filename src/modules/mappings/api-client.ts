import { apiClient } from "@/lib/apiClient";
import { GetMappingsResponseType } from "./types";

export const getMappings = async (): Promise<GetMappingsResponseType> => {
  const response = await apiClient.get<any, GetMappingsResponseType>("/mappings");
  return response;
};

export const createAddressMapping = async (
  source: string,
  destination: string
): Promise<void> => {
  await apiClient.post(
    `/mappings/address/${encodeURIComponent(source)}/targets/${encodeURIComponent(destination)}`
  );
};
