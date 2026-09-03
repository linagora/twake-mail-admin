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

export interface TaskResponse {
  taskId: string;
}
