import { useCallback, useRef } from "react";

function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Returns the focus to the control that opened a controlled dialog (one without DialogTrigger).
 * Radix restores the focus to the dialog trigger only: without one, closing drops it to the body.
 * Call rememberFocus when opening the dialog and pass restoreFocus to DialogContent's onCloseAutoFocus.
 */
export function useReturnFocus() {
  const returnTargetRef = useRef<HTMLElement | null>(null);

  const rememberFocus = useCallback(() => {
    returnTargetRef.current = focusedElement();
  }, []);

  const restoreFocus = useCallback((event: Event) => {
    const target = returnTargetRef.current;
    returnTargetRef.current = null;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  return { rememberFocus, restoreFocus };
}
