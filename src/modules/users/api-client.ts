import { apiClient } from "@/lib/apiClient";
import { GetUsersResponseType } from "./types";

export const getUsers = async (): Promise<GetUsersResponseType> => {
  const response = await apiClient.get<any, GetUsersResponseType>("/users");
  return response;
};
