import { loadAppConfig } from './env-config';
import { configureApiClient, installStaticTokenAuth } from './apiClient';

export const appConfig = loadAppConfig();
configureApiClient(appConfig.apiBaseUrl);

if (!appConfig.sso) {
  installStaticTokenAuth();
}
