import { apiClient } from "@/lib/apiClient";
import { GetDomainsResponseType } from "./types";

export const getDomains = async (): Promise<GetDomainsResponseType> => {
  const response = await apiClient.get<any, GetDomainsResponseType>("/domains");
  return response;
};
