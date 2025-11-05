import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getBearerToken, removeBearerToken } from "./auth";

// General error interface that can be used regardless of the HTTP client
export interface APIError {
  response?: AxiosResponse;
  message?: string;
}

// Global auth handler - will be set by AuthProvider
let globalAuthHandler: (() => Promise<string>) | null = null;

export const setGlobalAuthHandler = (handler: () => Promise<string>) => {
  globalAuthHandler = handler;
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add Authorization header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getBearerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry && globalAuthHandler) {
      originalRequest._retry = true;
      
      // Clear the invalid token from cookie
      removeBearerToken();
      
      try {
        const newToken = await globalAuthHandler();
        
        // Update the original request with the new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        
        // Retry the original request - this will return the actual response data
        const retryResponse = await apiClient.request(originalRequest);
        return retryResponse;
      } catch {
        // If authentication fails or is cancelled, reject with the original error
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);
