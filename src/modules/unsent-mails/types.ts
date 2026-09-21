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

/** Selection shared by the listing, the resend task and the delete task. */
export interface UnsentMailFilters {
  sender?: string;
  recipient?: string;
  limit?: number;
}

export interface TaskResponse {
  taskId: string;
}
