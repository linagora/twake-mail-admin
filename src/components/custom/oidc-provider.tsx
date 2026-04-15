import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as client from "openid-client";
import { getAccessToken, getRefreshToken, refreshTokens, redirectToLogin, clearTokens, getOIDCConfig } from "@/lib/oidc";
import { installOIDCAuth } from "@/lib/oidc-interceptors";
import { Button } from "@/components/ui/button";
import type { SSOConfig } from "@/lib/env-config";

function isLoggedOut(): boolean {
  return new URLSearchParams(window.location.search).get('logout') === '1';
}

interface OIDCContextType {
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const OIDCContext = createContext<OIDCContextType | undefined>(undefined);

interface OIDCProviderProps {
  config: SSOConfig;
  children: ReactNode;
}

export const OIDCProvider: React.FC<OIDCProviderProps> = ({ config, children }) => {
  const [isReady, setIsReady] = useState(false);
  const [loggedOut, setLoggedOut] = useState(() => isLoggedOut());
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    const oidcConfig = await getOIDCConfig(config);
    clearTokens();
    const endSessionUrl = client.buildEndSessionUrl(oidcConfig, {
      post_logout_redirect_uri: config.postLogoutRedirect,
    });
    window.location.href = endSessionUrl.toString();
  };

  useEffect(() => {
    installOIDCAuth(config);

    if (loggedOut) return;

    const init = async () => {
      // Access token in sessionStorage — still valid
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
  }, [config, loggedOut]);

  if (loggedOut) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6">
        <p className="text-muted-foreground text-lg">You have been logged out.</p>
        <Button
          size="lg"
          onClick={() => {
            // Strip ?logout=1 before starting a new login flow
            window.history.replaceState({}, '', window.location.pathname);
            setLoggedOut(false);
          }}
        >
          Reconnect
        </Button>
      </div>
    );
  }

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
    <OIDCContext.Provider value={{ isAuthenticated: true, logout }}>
      {children}
    </OIDCContext.Provider>
  );
};

export const useOIDC = (): OIDCContextType => {
  const context = useContext(OIDCContext);
  if (!context) throw new Error("useOIDC must be used within OIDCProvider");
  return context;
};
