import axios from "axios";

export interface ErrorMessage {
  message: string;
  details?: string;
}

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const XML_DOCUMENT_START = "<?xml";
const SABRE_ERROR_MESSAGE = /<s:message>([\s\S]*?)<\/s:message>/;

/**
 * Side services relay the raw error document of the DAV server (Sabre) in
 * `details`, stack trace included: keep only its human readable message.
 */
const withoutXmlDocument = (details: string | undefined): string | undefined => {
  const xmlStart = details?.indexOf(XML_DOCUMENT_START) ?? -1;
  if (!details || xmlStart < 0) {
    return details;
  }
  const context = details.slice(0, xmlStart).trim();
  const serverMessage = details.match(SABRE_ERROR_MESSAGE)?.[1].trim();
  return asText([context, serverMessage].filter(Boolean).join(" — "));
};

const fromResponseData = (data: unknown): ErrorMessage | undefined => {
  const text = asText(data);
  if (text) {
    return { message: text };
  }
  if (data && typeof data === "object") {
    const { message, details } = data as Record<string, unknown>;
    const serverMessage = asText(message);
    if (serverMessage) {
      return { message: serverMessage, details: withoutXmlDocument(asText(details)) };
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
