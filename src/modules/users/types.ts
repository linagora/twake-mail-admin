export interface User {
  username: string;
}

export type GetUsersResponseType = User[];

export interface Mailbox {
  mailboxName: string;
}

export type GetUserMailboxesResponseType = Mailbox[];
