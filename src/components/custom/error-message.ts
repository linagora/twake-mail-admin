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

/**
 * Clients reading a raw text body (e.g. /metrics) also receive the WebAdmin
 * JSON error body unparsed: parse it to reach its `message` / `details`.
 */
const parseJsonObject = (text: string): Record<string, unknown> | undefined => {
  if (!text.trim().startsWith("{")) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

/** WebAdmin answers built from an exception repeat their message in `details`: show it once. */
const distinctFrom = (message: string, details: string | undefined): string | undefined =>
  details?.trim() === message.trim() ? undefined : details;

const fromErrorBody = (body: Record<string, unknown>): ErrorMessage | undefined => {
  const serverMessage = asText(body.message);
  return serverMessage
    ? { message: serverMessage, details: distinctFrom(serverMessage, withoutXmlDocument(asText(body.details))) }
    : undefined;
};

const fromResponseData = (data: unknown): ErrorMessage | undefined => {
  const text = asText(data);
  if (text) {
    const body = parseJsonObject(text);
    return (body && fromErrorBody(body)) ?? { message: text };
  }
  if (data && typeof data === "object") {
    return fromErrorBody(data as Record<string, unknown>);
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
