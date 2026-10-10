import axios from "axios";

export interface ErrorMessage {
  message: string;
  details?: string;
}

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const fromResponseData = (data: unknown): ErrorMessage | undefined => {
  const text = asText(data);
  if (text) {
    return { message: text };
  }
  if (data && typeof data === "object") {
    const { message, details } = data as Record<string, unknown>;
    const serverMessage = asText(message);
    if (serverMessage) {
      return { message: serverMessage, details: asText(details) };
    }
  }
  return undefined;
};

const serialize = (error: unknown): string => {
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

/**
 * Extracts a human readable message from an error, preferring the
 * `message` / `details` returned by WebAdmin over the generic Axios message.
 */
export const toErrorMessage = (error: unknown): ErrorMessage => {
  if (axios.isAxiosError(error)) {
    return fromResponseData(error.response?.data) ?? { message: error.message };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: asText(error) ?? serialize(error) };
};
