import { createContext, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useReturnFocus } from "@/hooks/use-return-focus";

/**
 * Checks the dialog content when "Confirm" is clicked. Returns the error to show in the
 * dialog, which then stays open with its content, or null to let the dialog close.
 */
export type ConfirmValidator = () => string | null;

export interface ConfirmOptions {
  message: string | ReactNode;
  header: string;
  className?: string;
  validate?: ConfirmValidator;
}

export interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  error: string | null;
  resolve: ((value: boolean) => void) | null;
}

export interface ConfirmContextType {
  (options: ConfirmOptions): Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextType | null>(null);

const CLOSED_STATE: ConfirmState = { isOpen: false, message: '', header: '', error: null, resolve: null };

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
      setConfirmState({ ...options, isOpen: true, error: null, resolve });
    });
  };

  const handleClose = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState(CLOSED_STATE);
  };

  const handleConfirm = () => {
    const error = confirmState.validate?.() ?? null;
    if (error) {
      setConfirmState((current) => ({ ...current, error }));
      return;
    }
    handleClose(true);
  };

  // Any edit of the content may fix the reported problem: the error is re-checked on the next confirm.
  const clearError = () => setConfirmState((current) => (current.error ? { ...current, error: null } : current));

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={confirmState.isOpen} onOpenChange={(open) => !open && handleClose(false)}>
        <DialogContent className={confirmState.className} onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{confirmState.header}</DialogTitle>
          </DialogHeader>
          <div className="contents" onChange={clearError}>
            { typeof confirmState.message === 'string' ? <p>{confirmState.message}</p> : confirmState.message }
          </div>
          {confirmState.error && <p role="alert" className="text-sm text-red-600">{confirmState.error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>{t("common.cancel")}</Button>
            <Button className="mb-4 md:mb-0" onClick={handleConfirm}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
