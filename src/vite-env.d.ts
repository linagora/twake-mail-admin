/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ENV__?: {
    VITE_API_BASE_URL?: string;
    SSO_BASE_URL?: string;
    SSO_CLIENT_ID?: string;
    SSO_SCOPE?: string;
    SSO_REDIRECT_URI?: string;
    SSO_RESPONSE_TYPE?: string;
    SSO_CODE_CHALLENGE_METHOD?: string;
    SSO_POST_LOGOUT_REDIRECT?: string;
  };
}
