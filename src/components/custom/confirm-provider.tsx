import { createContext, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export interface ConfirmState {
  isOpen: boolean;
  message: string | ReactNode;
  header: string;
  className?: string;
  resolve: ((value: boolean) => void) | null;
}

export interface ConfirmContextType {
  ({ message, header, className }: { message: string | ReactNode; header: string; className?: string; }): Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextType | null>(null);

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const { t } = useTranslation();
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, message: '', header: '', resolve: null });

  const confirm: ConfirmContextType = ({ message, header, className }: { message: string | ReactNode; header: string; className?: string; }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ isOpen: true, message, header, className, resolve });
    });
  };

  const handleClose = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState({ isOpen: false, message: '', header: '', resolve: null });
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={confirmState.isOpen} onOpenChange={(open) => !open && handleClose(false)}>
        <DialogContent className={confirmState.className}>
          <DialogHeader>
            <DialogTitle>{confirmState.header}</DialogTitle>
          </DialogHeader>
          { typeof confirmState.message === 'string' ? <p>{confirmState.message}</p> : confirmState.message }
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>{t("common.cancel")}</Button>
            <Button className="mb-4 md:mb-0" onClick={() => handleClose(true)}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}