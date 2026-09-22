export interface UnsentMailId {
  id: string;
}

export interface SendingTrial {
  date: string;
  errorMessage: string;
}

export interface UnsentMail {
  id: string;
  mailFrom: string | null;
  rcptTo: string[];
  body: string;
  createdAt: string;
  sendingTrials: SendingTrial[];
}

/** Server side selection shared by the listing, resend and delete routes. */
export interface UnsentMailSelection {
  sender?: string;
  recipient?: string;
  limit?: number;
}

export interface TaskResponse {
  taskId: string;
}
