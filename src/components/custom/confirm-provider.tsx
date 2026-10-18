import { createContext, useState, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useReturnFocus } from "@/hooks/use-return-focus";
import ErrorDisplayer from "./error-displayer";

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

export interface ConfirmOptions {
  message: string | ReactNode;
  header: string;
  className?: string;
  validate?: ConfirmValidator;
  action?: ConfirmAction;
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

const CLOSED_STATE: ConfirmState = { isOpen: false, pending: false, message: '', header: '', error: null, resolve: null };

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const { t } = useTranslation();
  const [confirmState, setConfirmState] = useState<ConfirmState>(CLOSED_STATE);
  const { rememberFocus, restoreFocus } = useReturnFocus();

  const confirm: ConfirmContextType = (options: ConfirmOptions) => {
    rememberFocus();
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, isOpen: true, pending: false, error: null, resolve });
    });
  };

  const handleClose = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState(CLOSED_STATE);
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

  const handleConfirm = () => {
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

  // Any edit of the content may fix the reported problem: the error is re-checked on the next confirm.
  const clearError = () => setConfirmState((current) => (current.error ? { ...current, error: null } : current));

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={confirmState.isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className={confirmState.className} onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{confirmState.header}</DialogTitle>
          </DialogHeader>
          <div className="contents" onChange={clearError}>
            { typeof confirmState.message === 'string' ? <p>{confirmState.message}</p> : confirmState.message }
          </div>
          {confirmState.error && <div role="alert" className="text-sm text-red-600">{confirmState.error}</div>}
          <DialogFooter>
            <Button variant="outline" disabled={confirmState.pending} onClick={handleCancel}>{t("common.cancel")}</Button>
            <Button className="mb-4 md:mb-0" disabled={confirmState.pending} onClick={handleConfirm}>
              {confirmState.pending && <Loader2 className="animate-spin" />}
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
