// Type for the response, which is an array of group names
export type ListenerGroupsResponseType = string[];

// Type for the response, which is an array of insertion IDs
export type InsertionIdsResponseType = string[];

// Type for an event's details (assumed structure, should be adjusted based on actual API response)
export interface EventDetails {
  eventId: string;
  type: string;
  payload: any; // Adjust according to the actual event payload structure
}

// Type for the task response when redelivering events
export interface TaskResponse {
  taskId: string;
}