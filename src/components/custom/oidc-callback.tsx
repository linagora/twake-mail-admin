import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  exchangeCodeForTokens,
  storeTokens,
  getPostLoginRedirect,
  clearPostLoginRedirect,
} from "@/lib/oidc";
import type { SSOConfig } from "@/lib/env-config";

interface OIDCCallbackProps {
  config: SSOConfig;
}

// An SSO-level error returned in the callback URL, surfaced before attempting token exchange
const ssoErrorOf = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const errorParam = params.get('error');
  if (!errorParam) return null;
  const description = params.get('error_description') ?? '';
  return `SSO error: ${errorParam}${description ? ` — ${description}` : ''}`;
};

export const OIDCCallback: React.FC<OIDCCallbackProps> = ({ config }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(() => ssoErrorOf(window.location.search));

  useEffect(() => {
    if (ssoErrorOf(window.location.search)) return;

    exchangeCodeForTokens(config)
      .then((tokens) => {
        storeTokens(tokens);
        const redirectTo = getPostLoginRedirect();
        clearPostLoginRedirect();
        navigate(redirectTo, { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [config, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Authentication error: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-muted-foreground">Completing authentication…</p>
    </div>
  );
};
