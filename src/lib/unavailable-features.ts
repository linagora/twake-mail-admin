import { useSyncExternalStore } from "react";
import { apiClient } from "./apiClient";

/**
 * Features whose WebAdmin routes only some servers expose, found missing by a route-missing 404.
 * Remembered for the browser session, for the WebAdmin it was found on: a reload on another
 * base URL forgets it.
 */
export type OptionalFeature = "messageSearch" | "signatureTemplates";

const storageKey = (feature: OptionalFeature) => `twake-admin.${feature}Unavailable`;

const currentServer = () => apiClient.defaults.baseURL ?? "";

const listeners = new Set<() => void>();

// Without session storage, the flags do not outlive the page
const pageFlags = new Map<OptionalFeature, string>();

const readFlag = (feature: OptionalFeature): string | null => {
  try {
    return sessionStorage.getItem(storageKey(feature));
  } catch {
    return pageFlags.get(feature) ?? null;
  }
};

const writeFlag = (feature: OptionalFeature, server: string): void => {
  try {
    sessionStorage.setItem(storageKey(feature), server);
  } catch {
    pageFlags.set(feature, server);
  }
};

export const isFeatureUnavailable = (feature: OptionalFeature): boolean => readFlag(feature) === currentServer();

export const markFeatureUnavailable = (feature: OptionalFeature): void => {
  writeFlag(feature, currentServer());
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useFeatureUnavailable = (feature: OptionalFeature): boolean =>
  useSyncExternalStore(subscribe, () => isFeatureUnavailable(feature));
