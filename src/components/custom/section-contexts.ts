import { createContext } from "react";

/** What the pieces of the collapsible sections of a page share: their provider fills them. */

export interface SectionsContextValue {
  page: string;
  register: (id: string, defaultOpen: boolean) => () => void;
}

// What the sections of a page know about their object (a count…), for its summary strip
export type Facts = Record<string, unknown>;
export const FactsContext = createContext<{ facts: Facts; report: (id: string, value: unknown) => void } | null>(null);

export const contentIdOf = (id: string) => `section-${id}-content`;

export const SectionsContext = createContext<SectionsContextValue | null>(null);

export const SectionIdsContext = createContext<React.RefObject<Map<string, number>> | null>(null);
