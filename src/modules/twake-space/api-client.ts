import { apiClient } from "@/lib/apiClient";
import { SpaceSyncScope, syncSpacesQuery } from "./space";

// Only publishes the request: the sync itself happens asynchronously, no task is created
export const requestSpacesSync = async (scope: SpaceSyncScope): Promise<void> => {
  await apiClient.post(`/spaces?${syncSpacesQuery(scope)}`);
};
