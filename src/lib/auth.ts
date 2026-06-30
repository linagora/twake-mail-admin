export const BEARER_TOKEN_COOKIE = 'bearer_token';

export const setBearerToken = (token: string): void => {
  // Set cookie to expire in 7 days (after that if request failed with 401 again, it will show auth modal)
  // SameSite=Strict limits CSRF; Secure keeps the token off plaintext HTTP.
  // (HttpOnly cannot be set from JS — the token still lives in JS-readable
  // storage, hence the CSP defence-in-depth in nginx.conf.)
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${BEARER_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict${secure}`;
};

export const getBearerToken = (): string | null => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === BEARER_TOKEN_COOKIE) {
      return decodeURIComponent(value);
    }
  }
  return null;
};

export const removeBearerToken = (): void => {
  document.cookie = `${BEARER_TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};
