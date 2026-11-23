import { ReactNode } from "react";
import axios from "axios";
import { toErrorMessage } from "@/components/custom/error-message";
import ReprocessRefusalMessage from "./reprocess-refusal-message";

/** The reprocessing parameter WebAdmin refused with a 400, before taking any mail out of the repository. */
export type RefusedReprocessParam = "processor" | "queue";

// The WebAdmin messages: "'foo' processor is not configured", "'foo' mail queue does not exist"
const REFUSAL_MESSAGES: ReadonlyArray<readonly [RefusedReprocessParam, RegExp]> = [
  ["processor", /processor is not configured/i],
  ["queue", /mail queue does not exist/i],
];

export const refusedReprocessParam = (error: unknown): RefusedReprocessParam | null => {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return null;
  const { message } = toErrorMessage(error);
  return REFUSAL_MESSAGES.find(([, pattern]) => pattern.test(message))?.[0] ?? null;
};

/**
 * For the `describeError` of a reprocess dialog: names the refused field and says that no mail
 * was moved; null for any other error, shown as the server returned it.
 */
export const describeReprocessRefusal = (error: unknown): ReactNode | null => {
  const param = refusedReprocessParam(error);
  return param ? <ReprocessRefusalMessage param={param} error={error} /> : null;
};
