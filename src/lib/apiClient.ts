import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig, AxiosRequestConfig } from "axios";
import { getBearerToken, removeBearerToken } from "./auth";

export interface APIError {
  response?: AxiosResponse;
  message?: string;
}

// ponytail: marker so a caller can opt into receiving the full AxiosResponse
// (headers + body) instead of just `response.data`. Read by the response
// interceptors in apiClient and oidc-interceptors.
declare module "axios" {
  interface AxiosRequestConfig {
    __rawResponse?: boolean;
  }
}

/**
 * Performs a GET that resolves to the full AxiosResponse (headers + body).
 * Use for endpoints where response headers carry information.
 */
export async function getRaw<T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return apiClient.get(url, { ...config, __rawResponse: true }) as unknown as Promise<AxiosResponse<T>>;
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
    (response: AxiosResponse) => {
      if ((response.config as InternalAxiosRequestConfig).__rawResponse) {
        return response;
      }
      return response.data;
    },
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
