import { apiClient } from "@/lib/apiClient";
import { GlobalQuotaValues, UserSpecificQuota, QuotaExtraSummary } from "./types";

export const getGlobalQuota = async (): Promise<GlobalQuotaValues> => {
  return apiClient.get("/quota");
};

export const updateGlobalQuota = async (quota: GlobalQuotaValues): Promise<void> => {
  await apiClient.put("/quota", quota);
};

export const getUsersWithSpecificQuotas = async (): Promise<UserSpecificQuota[]> => {
  return apiClient.get("/reports/quota/users?hasSpecificQuota");
};

export const getQuotaExtraSummary = async (): Promise<QuotaExtraSummary> => {
  return apiClient.get("/reports/quota/users/sum?hasSpecificQuota");
};
