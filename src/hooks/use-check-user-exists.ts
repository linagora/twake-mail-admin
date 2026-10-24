import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/apiClient";

// No user name holds a space or more than one "@": the calendar server answers 404, not 400, for these
const USERNAME_PATTERN = /^[^\s@]+(@[^\s@]+)?$/;

export const isWellFormedUsername = (username: string): boolean => USERNAME_PATTERN.test(username);

export type UserExistsStatus = "idle" | "checking" | "exists" | "not_found" | "invalid";

// "not_found" stays submittable: callers ask for an explicit confirmation instead.
export const isSubmittableUserStatus = (status: UserExistsStatus): boolean =>
  status !== "checking" && status !== "invalid";

// checkSyntax false for an address field, e.g. a mapping source: the server's refusal says what is wrong
export function useCheckUserExists(username: string, { checkSyntax = true }: { checkSyntax?: boolean } = {}): UserExistsStatus {
  const [status, setStatus] = useState<UserExistsStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = username.trim();

    if (!trimmed) {
      setStatus("idle");
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setStatus("checking");

    timerRef.current = setTimeout(async () => {
      if (checkSyntax && !isWellFormedUsername(trimmed)) {
        setStatus("invalid");
        return;
      }
      try {
        await apiClient.head(`/users/${encodeURIComponent(trimmed)}`);
        setStatus("exists");
      } catch (err: any) {
        const code = err?.response?.status;
        if (code === 404) {
          setStatus("not_found");
        } else if (code === 400) {
          setStatus("invalid");
        } else {
          setStatus("not_found");
        }
      }
    }, 400);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [username, checkSyntax]);

  return status;
}
