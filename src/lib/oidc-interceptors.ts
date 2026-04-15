import { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './apiClient';
import { getAccessToken, clearAccessToken, refreshTokens, redirectToLogin } from './oidc';
import type { SSOConfig } from './env-config';

let installed = false;

export function installOIDCAuth(config: SSOConfig): void {
  if (installed) return;
  installed = true;

  apiClient.interceptors.request.use(
    (reqConfig: InternalAxiosRequestConfig) => {
      const token = getAccessToken();
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
      return reqConfig;
    },
    (error) => Promise.reject(error)
  );

  apiClient.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        clearAccessToken();

        try {
          const newToken = await refreshTokens(config);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return await apiClient.request(originalRequest);
        } catch {
          // Refresh failed — send user back to SSO login
          await redirectToLogin(config, window.location.pathname);
        }
      }

      return Promise.reject(error);
    }
  );
}
