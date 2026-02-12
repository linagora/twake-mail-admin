import { apiClient } from "@/lib/apiClient";
import { GetMappingsResponseType } from "./types";

export const getMappings = async (): Promise<GetMappingsResponseType> => {
  const response = await apiClient.get<any, GetMappingsResponseType>("/mappings");
  return response;
};
