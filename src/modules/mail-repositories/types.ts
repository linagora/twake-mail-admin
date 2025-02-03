// Define types based on the actual API response
export interface MailRepository {
  repository: string;
  path: string; // The encoded URL path of the repository
}

export type GetMailRepositoriesResponseType = MailRepository[]; // Array of mail repositories

// Type for the response, which is an array of mail keys
export type MailKeysResponseType = string[];
