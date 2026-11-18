import * as React from "react"

// Radix lets only its topmost layer handle Escape. A toast raised from inside a dialog is mounted
// after it, so it is that layer and would take the key away from the dialog holding the focus.
// The toast hands the key over to that dialog instead, through this DOM event.
const ESCAPE_HANDOFF = "twake:escape-handoff"

const DIALOG_SELECTOR = '[role="dialog"],[role="alertdialog"]'

function focusedDialog(event: KeyboardEvent): Element | null {
  return event.target instanceof Element ? event.target.closest(DIALOG_SELECTOR) : null
}

/** Gives the Escape to the dialog holding the focus. Returns false when the focus is in none. */
export function handOffEscapeToFocusedDialog(event: KeyboardEvent): boolean {
  const dialog = focusedDialog(event)
  dialog?.dispatchEvent(new CustomEvent<KeyboardEvent>(ESCAPE_HANDOFF, { detail: event }))
  return dialog !== null
}

/**
 * Lets a dialog handle the Escape a toast handed over to it, as Radix would: `onEscapeKeyDown` first,
 * then closing unless it prevented the default. Returns the ref to set on the dialog content.
 */
export function useEscapeHandoff<T extends Element>(
  onEscapeKeyDown: (event: KeyboardEvent) => void,
  close: () => void
): React.RefCallback<T> {
  const handlers = React.useRef({ onEscapeKeyDown, close })
  React.useLayoutEffect(() => {
    handlers.current = { onEscapeKeyDown, close }
  })

  return React.useCallback((node: T | null) => {
    if (!node) return
    const listener = (event: Event) => {
      const escape = (event as CustomEvent<KeyboardEvent>).detail
      handlers.current.onEscapeKeyDown(escape)
      if (!escape.defaultPrevented) handlers.current.close()
    }
    node.addEventListener(ESCAPE_HANDOFF, listener)
    return () => node.removeEventListener(ESCAPE_HANDOFF, listener)
  }, [])
}

/** Sets one node on both refs. */
export function useMergedRefs<T>(first: React.Ref<T> | undefined, second: React.Ref<T>): React.RefCallback<T> {
  return React.useCallback((node: T | null) => {
    const cleanups = [setRef(first, node), setRef(second, node)]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [first, second])
}

function setRef<T>(ref: React.Ref<T> | undefined, node: T | null): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(node)
    return typeof cleanup === "function" ? cleanup : () => ref(null)
  }
  if (ref) ref.current = node
  return () => {
    if (ref) ref.current = null
  }
}
