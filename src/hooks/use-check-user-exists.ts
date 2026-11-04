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
  // The status of the name it was checked for: another name, or another kind of check, is checked anew
  const [checked, setChecked] = useState<{ trimmed: string; checkSyntax: boolean; status: UserExistsStatus } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmed = username.trim();

  useEffect(() => {
    if (!trimmed) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const setStatus = (status: UserExistsStatus) => setChecked({ trimmed, checkSyntax, status });

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
  }, [trimmed, checkSyntax]);

  if (!trimmed) return "idle";
  return checked?.trimmed === trimmed && checked.checkSyntax === checkSyntax ? checked.status : "checking";
}
