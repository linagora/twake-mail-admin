import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAccessToken, getRefreshToken, refreshTokens, redirectToLogin } from "@/lib/oidc";
import { installOIDCAuth } from "@/lib/oidc-interceptors";
import type { SSOConfig } from "@/lib/env-config";

interface OIDCContextType {
  isAuthenticated: boolean;
}

const OIDCContext = createContext<OIDCContextType | undefined>(undefined);

interface OIDCProviderProps {
  config: SSOConfig;
  children: ReactNode;
}

export const OIDCProvider: React.FC<OIDCProviderProps> = ({ config, children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    installOIDCAuth(config);

    const init = async () => {
      // Access token already in memory (e.g. after callback redirect)
      if (getAccessToken()) {
        setIsReady(true);
        return;
      }

      // Refresh token in sessionStorage — silently renew
      if (getRefreshToken()) {
        try {
          await refreshTokens(config);
          setIsReady(true);
          return;
        } catch {
          // Refresh failed, fall through to login redirect
        }
      }

      // No usable token — redirect to SSO
      await redirectToLogin(config, window.location.pathname);
    };

    init().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [config]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">OIDC initialization error: {error}</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Authenticating…</p>
      </div>
    );
  }

  return (
    <OIDCContext.Provider value={{ isAuthenticated: true }}>
      {children}
    </OIDCContext.Provider>
  );
};

export const useOIDC = (): OIDCContextType => {
  const context = useContext(OIDCContext);
  if (!context) throw new Error("useOIDC must be used within OIDCProvider");
  return context;
};
