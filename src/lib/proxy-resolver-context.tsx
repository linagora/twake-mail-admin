import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "./apiClient";
import { appConfig } from "./config";
import { ProxyResolver, ProxyRule, HttpVerb } from "./proxy-resolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResolverState =
  | { status: "loading" }
  | { status: "ready"; resolver: ProxyResolver | null } // null = no restrictions
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Module-level cache — cleared on page reload (F5), survives React navigation
// ---------------------------------------------------------------------------

let rulesCache: Promise<ProxyRule[] | null> | null = null;

function fetchRules(): Promise<ProxyRule[] | null> {
  if (rulesCache) return rulesCache;
  rulesCache = apiClient
    .get<ProxyRule[] | string>("/.proxy/allowed/urls")
    .then((data) => (Array.isArray(data) ? data : null))
    .catch((err: any) => {
      rulesCache = null; // allow retry on next mount after error
      return Promise.reject(err);
    });
  return rulesCache;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ProxyResolverContext = createContext<ResolverState>({ status: "loading" });

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ProxyResolverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ResolverState>({ status: "loading" });

  useEffect(() => {
    // No SSO configured → static token auth → no restrictions
    if (!appConfig.sso) {
      setState({ status: "ready", resolver: null });
      return;
    }

    fetchRules()
      .then((rules) => {
        setState({
          status: "ready",
          resolver: rules === null ? null : new ProxyResolver(rules),
        });
      })
      .catch((err: any) => {
        const message =
          err?.response?.data?.message ?? err?.message ?? "Unknown error";
        setState({ status: "error", message });
      });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">
          Failed to load proxy rules: {state.message}
        </p>
      </div>
    );
  }

  return (
    <ProxyResolverContext.Provider value={state}>
      {children}
    </ProxyResolverContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Returns true if the given verb+pattern is allowed by the proxy rules.
 *  Always returns true when no SSO is configured (no restrictions apply). */
export function useIsAllowed(verb: HttpVerb, pattern: string): boolean {
  const state = useContext(ProxyResolverContext);
  if (state.status !== "ready") return false;
  if (state.resolver === null) return true; // no restrictions
  return state.resolver.isAllowed(verb, pattern);
}
