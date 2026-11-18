// The static WebAdmin token lives in sessionStorage, as the OIDC tokens do (see oidc.ts):
// it is dropped when the tab closes, is never sent to the server serving the app, and is not
// shared with the applications served on other ports of the same host name, as a cookie would be.
// (It stays readable from JS, hence the CSP defence-in-depth in nginx.conf.)
export const BEARER_TOKEN_KEY = 'bearer_token';

// Earlier versions kept the token 7 days in a cookie of that name
const LEGACY_BEARER_TOKEN_COOKIE = 'bearer_token';

export const dropLegacyBearerCookie = (): void => {
  document.cookie = `${LEGACY_BEARER_TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

export const setBearerToken = (token: string): void => {
  dropLegacyBearerCookie();
  sessionStorage.setItem(BEARER_TOKEN_KEY, token);
};

export const getBearerToken = (): string | null => sessionStorage.getItem(BEARER_TOKEN_KEY);

export const removeBearerToken = (): void => {
  dropLegacyBearerCookie();
  sessionStorage.removeItem(BEARER_TOKEN_KEY);
};
