import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { AuthModal } from "./auth-modal";
import { setBearerToken, getBearerToken, removeBearerToken } from "@/lib/auth";
import { setGlobalAuthHandler } from "@/lib/apiClient";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  showAuthModal: () => Promise<string>;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => getBearerToken());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authPromiseResolve, setAuthPromiseResolve] = useState<((token: string) => void) | null>(null);
  const [authPromiseReject, setAuthPromiseReject] = useState<((error: Error) => void) | null>(null);

  const setToken = useCallback((newToken: string) => {
    setBearerToken(newToken);
    setTokenState(newToken);
  }, []);

  const clearToken = useCallback(() => {
    removeBearerToken();
    setTokenState(null);
  }, []);

  const showAuthModal = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      setAuthPromiseResolve(() => resolve);
      setAuthPromiseReject(() => reject);
      setIsModalOpen(true);
    });
  }, []);

  const handleAuthSubmit = useCallback(async (newToken: string) => {
    try {
      setToken(newToken);
      setIsModalOpen(false);
      authPromiseResolve?.(newToken);
      setAuthPromiseResolve(null);
      setAuthPromiseReject(null);
    } catch (error) {
      authPromiseReject?.(error instanceof Error ? error : new Error("Authentication failed"));
    }
  }, [setToken, authPromiseResolve, authPromiseReject]);

  const handleAuthCancel = useCallback(() => {
    setIsModalOpen(false);
    authPromiseReject?.(new Error("Authentication cancelled"));
    setAuthPromiseResolve(null);
    setAuthPromiseReject(null);
  }, [authPromiseReject]);

  // Register the auth handler with the API client
  useEffect(() => {
    setGlobalAuthHandler(showAuthModal);
  }, [showAuthModal]);

  const contextValue: AuthContextType = {
    token,
    isAuthenticated: !!token,
    showAuthModal,
    setToken,
    clearToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      <AuthModal
        isOpen={isModalOpen}
        onSubmit={handleAuthSubmit}
        onCancel={handleAuthCancel}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
