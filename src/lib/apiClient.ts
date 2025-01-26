import axios, { AxiosResponse, AxiosError } from "axios";

// General error interface that can be used regardless of the HTTP client
export interface APIError {
  response?: AxiosResponse;
  message?: string;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);
