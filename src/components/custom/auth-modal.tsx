import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AuthModalProps {
  isOpen: boolean;
  onSubmit: (token: string) => Promise<void>;
  onCancel?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(token.trim());
      setToken('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setToken('');
    onCancel?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("auth.title")}
          </DialogTitle>
          <DialogDescription>
            {t("auth.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                {t("auth.tokenLabel")}
              </label>
              <Input
                id="token"
                type="password"
                placeholder={t("auth.tokenPlaceholder")}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {t("auth.cancel")}
            </Button>
            <Button type="submit" disabled={!token.trim() || isSubmitting}>
              {isSubmitting ? t("auth.authenticating") : t("auth.authenticate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
