import { apiClient } from "@/lib/apiClient";
import { RegisteredUser } from "./types";

export const getRegisteredUsers = async (): Promise<RegisteredUser[]> => {
  return apiClient.get<any, RegisteredUser[]>("/registeredUsers");
};

export const createRegisteredUser = async (user: RegisteredUser): Promise<void> => {
  await apiClient.post("/registeredUsers", user);
};

export const updateRegisteredUser = async (
  id: string,
  data: { email?: string; firstname?: string; lastname?: string }
): Promise<void> => {
  await apiClient.patch(`/registeredUsers?id=${encodeURIComponent(id)}`, data);
};
