import { ConfirmContext, ConfirmContextType } from "@/components/custom/confirm-provider";
import { useContext } from "react";

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}