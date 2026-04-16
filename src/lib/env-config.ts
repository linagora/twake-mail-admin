export type AppMode = 'GLOBAL' | 'DOMAIN';
export type AppApplication = 'MAIL' | 'CALENDAR';

const SSO_REQUIRED_KEYS = [
  'SSO_BASE_URL',
  'SSO_CLIENT_ID',
  'SSO_SCOPE',
  'SSO_REDIRECT_URI',
  'SSO_RESPONSE_TYPE',
  'SSO_CODE_CHALLENGE_METHOD',
  'SSO_POST_LOGOUT_REDIRECT',
] as const;

export interface SSOConfig {
  baseUrl: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  responseType: string;
  codeChallengeMethod: string;
  postLogoutRedirect: string;
}

export interface AppConfig {
  apiBaseUrl: string;
  mode: AppMode;
  application: AppApplication;
  /** DOMAIN mode only. null = must be resolved via /.proxy/myDomain */
  domain: string | null;
  sso: SSOConfig | null;
}

function getEnvVar(key: string): string | undefined {
  const val = (window as any).__ENV__?.[key] ?? import.meta.env[key];
  return val !== undefined && val !== '' ? String(val) : undefined;
}

export function loadAppConfig(): AppConfig {
  const apiBaseUrl =
    (window as any).__ENV__?.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    '';

  const rawMode = getEnvVar('MODE') ?? 'GLOBAL';
  const mode: AppMode = rawMode === 'DOMAIN' ? 'DOMAIN' : 'GLOBAL';
  const domain = getEnvVar('DOMAIN') ?? null;

  const rawApplication = getEnvVar('APPLICATION') ?? 'MAIL';
  const application: AppApplication = rawApplication === 'CALENDAR' ? 'CALENDAR' : 'MAIL';


  const presentKeys = SSO_REQUIRED_KEYS.filter((k) => getEnvVar(k) !== undefined);

  if (presentKeys.length === 0) {
    return { apiBaseUrl, mode, application, domain, sso: null };
  }

  const missingKeys = SSO_REQUIRED_KEYS.filter((k) => getEnvVar(k) === undefined);
  if (missingKeys.length > 0) {
    throw new Error(
      `Partial SSO setup: the following variables are missing: ${missingKeys.join(', ')}`
    );
  }

  return {
    apiBaseUrl,
    mode,
    application,
    domain,
    sso: {
      baseUrl: getEnvVar('SSO_BASE_URL')!,
      clientId: getEnvVar('SSO_CLIENT_ID')!,
      scope: getEnvVar('SSO_SCOPE')!,
      redirectUri: getEnvVar('SSO_REDIRECT_URI')!,
      responseType: getEnvVar('SSO_RESPONSE_TYPE')!,
      codeChallengeMethod: getEnvVar('SSO_CODE_CHALLENGE_METHOD')!,
      postLogoutRedirect: getEnvVar('SSO_POST_LOGOUT_REDIRECT')!,
    },
  };
}
