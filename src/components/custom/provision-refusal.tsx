import { ReactNode } from "react";
import axios from "axios";
import { toErrorMessage } from "@/components/custom/error-message";
import ProvisionRefusalMessage from "./provision-refusal-message";

/** The provisioning parameter WebAdmin refused with a 400, before creating any task. */
export type RefusedProvisionParam = "source" | "folder";

// The WebAdmin messages: "'from' query parameter must be an account of the domain 'a.org'",
// "Invalid 'folderName' value 'INBOX'. Expected 'Templates' or one of its sub-folders."
const REFUSAL_MESSAGES: ReadonlyArray<readonly [RefusedProvisionParam, RegExp]> = [
  ["source", /'from' query parameter must be an account of/i],
  ["folder", /Invalid 'folderName' value/i],
];

export const refusedProvisionParam = (error: unknown): RefusedProvisionParam | null => {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return null;
  const { message } = toErrorMessage(error);
  return REFUSAL_MESSAGES.find(([, pattern]) => pattern.test(message))?.[0] ?? null;
};

/**
 * For the `describeError` of a provision templates dialog: names the refused field above the
 * server message; null for any other error, shown as the server returned it.
 */
export const describeProvisionRefusal = (domain: string) => (error: unknown): ReactNode | null => {
  const param = refusedProvisionParam(error);
  return param ? <ProvisionRefusalMessage param={param} domain={domain} error={error} /> : null;
};
