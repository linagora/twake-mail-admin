import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getBearerToken, removeBearerToken } from "./auth";

export interface APIError {
  response?: AxiosResponse;
  message?: string;
}

// Injected by AuthProvider (static token mode only)
let globalAuthHandler: (() => Promise<string>) | null = null;

export const setGlobalAuthHandler = (handler: () => Promise<string>) => {
  globalAuthHandler = handler;
};

export const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

export function configureApiClient(baseURL: string): void {
  apiClient.defaults.baseURL = baseURL;
}

/**
 * Installs interceptors for static bearer-token auth (current behaviour):
 * - Reads token from cookie on every request.
 * - On 401, clears the cookie and prompts the user for a new token via modal.
 * Called once at startup when no SSO config is present.
 */
export function installStaticTokenAuth(): void {
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getBearerToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  apiClient.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry && globalAuthHandler) {
        originalRequest._retry = true;
        removeBearerToken();

        try {
          const newToken = await globalAuthHandler();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return await apiClient.request(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );
}
