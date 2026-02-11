import { apiClient } from "@/lib/apiClient";
import { RunTaskResponse } from "@/modules/common-tasks/types";

export interface CassandraVersion {
  version: number;
}

export const getCassandraVersion = async (): Promise<CassandraVersion> => {
  return apiClient.get("/cassandra/version");
};

export const getCassandraLatestVersion = async (): Promise<CassandraVersion> => {
  return apiClient.get("/cassandra/version/latest");
};

export const upgradeCassandraToLatest = async (): Promise<RunTaskResponse> => {
  return apiClient.post("/cassandra/version/upgrade/latest");
};
