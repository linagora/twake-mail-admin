import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response: any) => response?.data,
  (error: { response: any; message: any; }) => {
    return Promise.reject(error);
  }
);

export const getHealthCheck = async () => {
  return await apiClient.get('/healthcheck');
};
