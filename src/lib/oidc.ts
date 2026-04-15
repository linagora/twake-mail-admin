import * as client from 'openid-client';
import type { SSOConfig } from './env-config';

const STORAGE_KEYS = {
  CODE_VERIFIER: 'oidc_code_verifier',
  STATE: 'oidc_state',
  REFRESH_TOKEN: 'oidc_refresh_token',
  POST_LOGIN_REDIRECT: 'oidc_post_login_redirect',
} as const;

// Access token lives in memory only — cleared on page refresh
let currentAccessToken: string | null = null;
let cachedConfig: client.Configuration | null = null;

// --- OIDC discovery (cached) ---

export async function getOIDCConfig(ssoConfig: SSOConfig): Promise<client.Configuration> {
  if (!cachedConfig) {
    cachedConfig = await client.discovery(new URL(ssoConfig.baseUrl), ssoConfig.clientId);
  }
  return cachedConfig;
}

// --- Token accessors ---

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function storeTokens(tokens: { access_token: string; refresh_token?: string }): void {
  currentAccessToken = tokens.access_token;
  if (tokens.refresh_token) {
    sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  }
}

export function clearTokens(): void {
  currentAccessToken = null;
  sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function clearAccessToken(): void {
  currentAccessToken = null;
}

// --- Login redirect ---

export async function redirectToLogin(ssoConfig: SSOConfig, currentPath?: string): Promise<never> {
  const oidcConfig = await getOIDCConfig(ssoConfig);

  const code_verifier = client.randomPKCECodeVerifier();
  const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
  const state = client.randomState();

  sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, code_verifier);
  sessionStorage.setItem(STORAGE_KEYS.STATE, state);
  if (currentPath && currentPath !== '/oidc-callback') {
    sessionStorage.setItem(STORAGE_KEYS.POST_LOGIN_REDIRECT, currentPath);
  }

  const redirectUrl = client.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: ssoConfig.redirectUri,
    scope: ssoConfig.scope,
    code_challenge,
    code_challenge_method: ssoConfig.codeChallengeMethod,
    state,
  });

  window.location.href = redirectUrl.toString();
  // Page navigates away — this promise never resolves
  return new Promise(() => {});
}

export function getPostLoginRedirect(): string {
  return sessionStorage.getItem(STORAGE_KEYS.POST_LOGIN_REDIRECT) || '/';
}

export function clearPostLoginRedirect(): void {
  sessionStorage.removeItem(STORAGE_KEYS.POST_LOGIN_REDIRECT);
}

// --- Token exchange (authorization code → tokens) ---
// Reads code + state from the current URL; validates state to prevent CSRF.

export async function exchangeCodeForTokens(
  ssoConfig: SSOConfig
): Promise<{ access_token: string; refresh_token?: string }> {
  const oidcConfig = await getOIDCConfig(ssoConfig);

  const code_verifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  const state = sessionStorage.getItem(STORAGE_KEYS.STATE) ?? undefined;

  if (!code_verifier) throw new Error('Missing PKCE code verifier');

  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEYS.STATE);

  const tokenSet = await client.authorizationCodeGrant(
    oidcConfig,
    new URL(window.location.href),
    { pkceCodeVerifier: code_verifier, expectedState: state }
  );

  return {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token,
  };
}

// --- Silent token refresh ---

export async function refreshTokens(ssoConfig: SSOConfig): Promise<string> {
  const oidcConfig = await getOIDCConfig(ssoConfig);
  const refreshToken = getRefreshToken();

  if (!refreshToken) throw new Error('No refresh token available');

  const tokenSet = await client.refreshTokenGrant(oidcConfig, refreshToken);

  storeTokens({
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token,
  });

  return tokenSet.access_token;
}
