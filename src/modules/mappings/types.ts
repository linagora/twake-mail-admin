export interface MappingEntry {
  type: string;
  mapping: string;
}

export type GetMappingsResponseType = Record<string, MappingEntry[]>;

export interface FlatMapping {
  source: string;
  type: string;
  destination: string;
}
