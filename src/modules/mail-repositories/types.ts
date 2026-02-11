// Define types based on the actual API response
export interface MailRepository {
  repository: string;
  path: string; // The encoded URL path of the repository
}

export type GetMailRepositoriesResponseType = MailRepository[]; // Array of mail repositories

// Type for the response, which is an array of mail keys
export type MailKeysResponseType = string[];

export interface RepositoryInfo {
  repository: string;
  path: string;
  size: number;
}

export interface MailDetail {
  name: string;
  sender: string;
  recipients: string[];
  state: string;
  error: string;
  remoteHost: string;
  remoteAddr: string;
  lastUpdated: string | null;
}
