import { createContext, useContext } from "react";

const DomainContext = createContext<string>("");

export const DomainProvider = DomainContext.Provider;

export function useDomain(): string {
  return useContext(DomainContext);
}
