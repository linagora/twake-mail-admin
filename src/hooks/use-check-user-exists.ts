import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/apiClient";

export type UserExistsStatus = "idle" | "checking" | "exists" | "not_found" | "invalid";

export function useCheckUserExists(username: string): UserExistsStatus {
  const [status, setStatus] = useState<UserExistsStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = username.trim();

    if (!trimmed) {
      setStatus("idle");
      return;
    }

    setStatus("checking");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
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
  }, [username]);

  return status;
}
