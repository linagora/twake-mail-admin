export interface NetworkChannel {
  protocol: string;
  endpoint: string;
  remoteAddress: string;
  connectionDate: string;
  isActive: boolean;
  isOpen: boolean;
  isWritable: boolean;
  isEncrypted: boolean;
  username: string;
  protocolSpecificInformation: Record<string, string>;
}

export type GetUserChannelsResponseType = NetworkChannel[];

export interface ChannelQueryParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  sortType?: "alphabetical" | "numerical";
}
