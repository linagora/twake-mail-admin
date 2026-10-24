import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { createMailRepository } from "./api-client";

const INPUT_CLASS = "w-full border rounded px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2";
const DEFAULT_PROTOCOL = "cassandra";

type Field = "path" | "protocol";

const REQUIRED_KEYS: Record<Field, string> = {
  path: "mailRepositories.pathRequired",
  protocol: "mailRepositories.protocolRequired",
};

const missingFields = (values: Record<Field, string>): Field[] =>
  (Object.keys(values) as Field[]).filter((field) => values[field].trim() === "");

interface Props {
  // Called once the repository is created, so the list can be re-read.
  onCreated: () => void;
}

/**
 * Creates a mail repository. The dialog only closes once the repository is created or the
 * creation is cancelled: a missing field is flagged in place and keeps the typed values.
 */
export default function CreateMailRepositoryButton({ onCreated }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<Field, string>>({ path: "", protocol: DEFAULT_PROTOCOL });
  const [missing, setMissing] = useState<Field[]>([]);
  const [creating, setCreating] = useState(false);

  const close = () => {
    setOpen(false);
    setValues({ path: "", protocol: DEFAULT_PROTOCOL });
    setMissing([]);
  };

  const update = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setMissing((current) => current.filter((f) => f !== field));
  };

  const handleCreate = async () => {
    const invalid = missingFields(values);
    setMissing(invalid);
    if (invalid.length > 0) return;
    setCreating(true);
    try {
      await createMailRepository(encodeURIComponent(values.path.trim()), values.protocol.trim());
      close();
      toast({ title: t("mailRepositories.created") });
      onCreated();
    } catch (err) {
      toast({
        title: t("mailRepositories.createError"),
        description: <ErrorDisplayer error={err} />,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const renderField = (field: Field, label: string, placeholder?: string) => {
    const isMissing = missing.includes(field);
    const id = `mail-repository-${field}`;
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={id}>
          {label} <span className="text-red-500">*</span>
        </label>
        <input
          id={id}
          className={`${INPUT_CLASS} ${isMissing ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"}`}
          placeholder={placeholder}
          value={values[field]}
          aria-invalid={isMissing}
          onChange={(e) => update(field, e.target.value)}
        />
        {isMissing && <p className="text-xs text-red-600">{t(REQUIRED_KEYS[field])}</p>}
      </div>
    );
  };

  return (
    <>
      <button
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-4 h-4" />
        {t("mailRepositories.newRepository")}
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("mailRepositories.createTitle")}</DialogTitle>
          </DialogHeader>
          {/* A form, so that Enter in a field submits like Confirm */}
          <form onSubmit={(e) => { e.preventDefault(); if (!creating) handleCreate(); }}>
            <div className="space-y-3 py-2">
              {renderField("path", t("mailRepositories.pathLabel"), t("mailRepositories.pathPlaceholder"))}
              {renderField("protocol", t("mailRepositories.protocolLabel"))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>{t("common.cancel")}</Button>
              <Button type="submit" className="mb-4 md:mb-0" disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("common.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
