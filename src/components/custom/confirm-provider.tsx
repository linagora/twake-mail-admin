import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, ReactNode } from "react";
import { useInRouterContext, useLocation } from "react-router";
import { Loader2, TriangleAlert } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useReturnFocus } from "@/hooks/use-return-focus";
import ErrorDisplayer from "./error-displayer";
import { cn } from "@/lib/utils";

/**
 * Checks the dialog content when "Confirm" is clicked. Returns the error to show in the
 * dialog, which then stays open with its content, false to keep it open without a message
 * when the content already reports the problem, or null to let the dialog close.
 */
export type ConfirmValidator = () => string | false | null;

/**
 * Sends the confirmed request while the dialog stays open. The dialog closes once it
 * succeeds; when it fails, the error is shown in the dialog, which keeps its content
 * so that it can be corrected and confirmed again.
 */
export type ConfirmAction = () => Promise<unknown>;

/** How the confirm button looks, which the dialog content can change while the operator types. */
export interface ConfirmAppearance {
  /**
   * Irreversible action: red confirm button, initial focus on "Cancel" (or on the
   * type-to-confirm field), so that Enter right after opening does not run it.
   */
  destructive?: boolean;
  /** Replaces "Confirm" with a verb naming the action. */
  confirmLabel?: string;
  /** What will be lost, shown above the message in a red-bordered block. */
  consequence?: ReactNode;
}

export interface ConfirmOptions extends ConfirmAppearance {
  message: string | ReactNode;
  header: string;
  className?: string;
  validate?: ConfirmValidator;
  action?: ConfirmAction;
  /** The confirm button stays disabled until this text is typed (surrounding spaces ignored). */
  typeToConfirm?: string;
  /** Compares the typed text case-insensitively: user names, domains. */
  typeToConfirmIgnoreCase?: boolean;
  /** Replaces "Cancel", e.g. with "Keep editing". */
  cancelLabel?: string;
}

export interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  pending: boolean;
  error: ReactNode | null;
  resolve: ((value: boolean) => void) | null;
}

export interface ConfirmContextType {
  (options: ConfirmOptions): Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextType | null>(null);

type AppearanceUpdate = ConfirmAppearance | ((current: ConfirmAppearance) => ConfirmAppearance);

const ConfirmAppearanceContext = createContext<((appearance: AppearanceUpdate) => void) | null>(null);

const FocusCancelContext = createContext<(() => void) | null>(null);

/**
 * Called by a dialog content whose fields are all optional, e.g. task parameters: the
 * dialog opens with the focus on "Cancel" rather than in the first field.
 */
export function useFocusCancelOnOpen(enabled = true): void {
  const request = useContext(FocusCancelContext);
  // Before the dialog moves its initial focus, which happens in an effect of an ancestor
  useLayoutEffect(() => {
    if (enabled) request?.();
  }, [enabled, request]);
}

/**
 * Lets the content of a confirm dialog change its confirm button, e.g. turn it red with
 * another label while the typed parameters make the action irreversible.
 */
export function useConfirmAppearance(): (appearance: AppearanceUpdate) => void {
  return useContext(ConfirmAppearanceContext) ?? (() => {});
}

export const matchesTypeToConfirm = (typed: string, expected: string, ignoreCase = false): boolean =>
  ignoreCase ? typed.trim().toLowerCase() === expected.trim().toLowerCase() : typed.trim() === expected.trim();

const CLOSED_STATE: ConfirmState = { isOpen: false, pending: false, message: '', header: '', error: null, resolve: null };

interface ConfirmProviderProps {
  children: ReactNode;
}

// Calls onNavigate when the route changes, not on mount
function OnNavigation({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  return null;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const { t } = useTranslation();
  const [confirmState, setConfirmState] = useState<ConfirmState>(CLOSED_STATE);
  const [typed, setTyped] = useState("");
  const { rememberFocus, restoreFocus } = useReturnFocus();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);
  const typeId = useId();
  const focusCancel = useRef(false);
  const [requestFocusCancel] = useState(() => () => { focusCancel.current = true; });

  const confirm: ConfirmContextType = (options: ConfirmOptions) => {
    rememberFocus();
    setTyped("");
    focusCancel.current = false;
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, isOpen: true, pending: false, error: null, resolve });
    });
  };

  const [setAppearance] = useState(() => (appearance: AppearanceUpdate) =>
    setConfirmState((current) => (current.isOpen
      ? { ...current, ...(typeof appearance === "function" ? appearance(current) : appearance) }
      : current)));

  // Only closes: the content stays as it was while the dialog fades out, until the next confirm replaces it
  const handleClose = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState((current) => ({ ...current, isOpen: false, pending: false, resolve: null }));
  };

  const showError = (error: ReactNode) => setConfirmState((current) => ({ ...current, pending: false, error }));

  const runAction = async (action: ConfirmAction) => {
    setConfirmState((current) => ({ ...current, pending: true, error: null }));
    try {
      await action();
      handleClose(true);
    } catch (err) {
      showError(<ErrorDisplayer error={err} />);
    }
  };

  const typedMatches = confirmState.typeToConfirm === undefined
    || matchesTypeToConfirm(typed, confirmState.typeToConfirm, confirmState.typeToConfirmIgnoreCase);

  const handleConfirm = () => {
    if (!typedMatches) return;
    const error = confirmState.validate?.() ?? null;
    if (error === false) return;
    if (error) {
      showError(error);
      return;
    }
    if (confirmState.action) {
      runAction(confirmState.action);
      return;
    }
    handleClose(true);
  };

  // A request in flight can no longer be cancelled: wait for its outcome.
  const handleCancel = () => {
    if (!confirmState.pending) handleClose(false);
  };

  // A link followed from the dialog (e.g. "See the users of the domain") leaves its page: the
  // dialog is cancelled rather than left open over another page
  const inRouter = useInRouterContext();
  const latestCancel = useRef(handleCancel);
  latestCancel.current = handleCancel;

  // Any edit of the content may fix the reported problem: the error is re-checked on the next confirm.
  const clearError = () => setConfirmState((current) => (current.error ? { ...current, error: null } : current));

  // A destructive dialog never opens with the focus on a field or on the confirm button
  const handleOpenAutoFocus = (event: Event) => {
    const target = confirmState.typeToConfirm !== undefined ? typeRef.current
      : confirmState.destructive || focusCancel.current ? cancelRef.current
      : null;
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {inRouter && <OnNavigation onNavigate={() => { if (confirmState.isOpen) latestCancel.current(); }} />}
      {children}
      <Dialog open={confirmState.isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className={cn("has-[[data-task-params]]:max-w-2xl", confirmState.className)} onOpenAutoFocus={handleOpenAutoFocus} onCloseAutoFocus={restoreFocus}
          // A text message is the dialog's description; a content with fields, read as it is browsed
          {...(typeof confirmState.message === 'string' ? {} : { "aria-describedby": undefined })}>
          <DialogHeader>
            <DialogTitle>{confirmState.header}</DialogTitle>
          </DialogHeader>
          {confirmState.consequence && (
            <div className="flex gap-2 items-start border-l-4 border-red-600 bg-red-50 text-red-900 p-3 text-sm">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>{confirmState.consequence}</div>
            </div>
          )}
          <ConfirmAppearanceContext.Provider value={setAppearance}>
            <FocusCancelContext.Provider value={requestFocusCancel}>
              <div className="contents" onChange={clearError}>
                { typeof confirmState.message === 'string'
                  ? <DialogPrimitive.Description asChild><p>{confirmState.message}</p></DialogPrimitive.Description>
                  : confirmState.message }
              </div>
            </FocusCancelContext.Provider>
          </ConfirmAppearanceContext.Provider>
          {confirmState.typeToConfirm !== undefined && (
            <div>
              <label htmlFor={typeId} className="text-sm font-medium">
                {t("confirm.typeToConfirm", { value: confirmState.typeToConfirm })}
              </label>
              <input
                id={typeId}
                ref={typeRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}
          {confirmState.error && <div role="alert" className="text-sm text-red-600">{confirmState.error}</div>}
          <DialogFooter>
            <Button ref={cancelRef} variant="outline" disabled={confirmState.pending} onClick={handleCancel}>{confirmState.cancelLabel ?? t("common.cancel")}</Button>
            <Button
              className="mb-4 md:mb-0"
              variant={confirmState.destructive ? "destructive" : "default"}
              disabled={confirmState.pending || !typedMatches}
              onClick={handleConfirm}
            >
              {confirmState.pending && <Loader2 className="animate-spin" />}
              {confirmState.confirmLabel ?? t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
