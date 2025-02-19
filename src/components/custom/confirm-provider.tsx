import { createContext, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmState {
  isOpen: boolean;
  message: string | ReactNode;
  header: string;
  resolve: ((value: boolean) => void) | null;
}

export interface ConfirmContextType {
  ({ message, header }: { message: string | ReactNode; header: string; }): Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextType | null>(null);

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, message: '', header: '', resolve: null });

  const confirm: ConfirmContextType = ({ message, header }: { message: string | ReactNode; header: string; }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ isOpen: true, message, header, resolve });
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmState.header}</DialogTitle>
          </DialogHeader>
          { typeof confirmState.message === 'string' ? <p>{confirmState.message}</p> : confirmState.message }
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
            <Button className="mb-4 md:mb-0" onClick={() => handleClose(true)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}