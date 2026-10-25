import { useEffect, useRef, useState } from "react";

// A running task is read again this often on its page, until it is over
export const TASK_AUTO_REFRESH_MS = 2000;
// The whole list is heavier to read: it is read again less often, while one of its tasks runs
export const TASK_LIST_AUTO_REFRESH_MS = 5000;

const isTabVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

/**
 * Calls `refresh` every `intervalMs` while `active`, and only while the browser tab is shown:
 * no request is sent from a hidden tab, and the data is read again as soon as it is shown.
 * Returns whether the data is currently being followed.
 */
export function useAutoRefresh(active: boolean, refresh: () => unknown, intervalMs: number): boolean {
  const [visible, setVisible] = useState(isTabVisible);
  // The latest callback, so that a new render does not restart the timer
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;

  useEffect(() => {
    const onVisibilityChange = () => setVisible(isTabVisible());
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const following = active && visible;
  const wasVisible = useRef(visible);
  useEffect(() => {
    // Back on the tab: what changed meanwhile is shown at once, not after a full interval
    if (following && !wasVisible.current) latestRefresh.current();
    wasVisible.current = visible;
  }, [following, visible]);

  useEffect(() => {
    if (!following) return;
    const timer = window.setInterval(() => latestRefresh.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [following, intervalMs]);

  return following;
}
