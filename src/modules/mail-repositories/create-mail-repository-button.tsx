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
// Usual protocols, offered as suggestions: the field still accepts any protocol the server supports
const SUGGESTED_PROTOCOLS = ["cassandra", "postgres", "file", "memory"];
const PROTOCOL_SUGGESTIONS_ID = "mail-repository-protocol-suggestions";

type Field = "path" | "protocol";

const REQUIRED_KEYS: Record<Field, string> = {
  path: "mailRepositories.pathRequired",
  protocol: "mailRepositories.protocolRequired",
};

const missingFields = (values: Record<Field, string>): Field[] =>
  (Object.keys(values) as Field[]).filter((field) => values[field].trim() === "");

// WebAdmin stores any path as typed and offers no way to delete a repository: a path with an empty
// part (a leading, trailing or doubled "/") or a "." / ".." part is refused before it is sent
const isMalformedPath = (path: string): boolean =>
  path.split("/").some((part) => part === "" || part === "." || part === "..");

interface Props {
  // The repositories the list already shows: WebAdmin answers 204 to an existing path too
  existingRepositories: readonly string[];
  // Called once the repository is created, so the list can be re-read.
  onCreated: () => void;
}

/**
 * Creates a mail repository. The dialog only closes once the repository is created or the
 * creation is cancelled: a missing field is flagged in place and keeps the typed values, and
 * a refusal is shown in the dialog, where its text can be selected: the dialog keeps the focus
 * inside it, so a toast over it could not be.
 */
export default function CreateMailRepositoryButton({ existingRepositories, onCreated }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<Field, string>>({ path: "", protocol: DEFAULT_PROTOCOL });
  const [missing, setMissing] = useState<Field[]>([]);
  const [existingPath, setExistingPath] = useState<string | null>(null);
  const [malformedPath, setMalformedPath] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const close = () => {
    setOpen(false);
    setValues({ path: "", protocol: DEFAULT_PROTOCOL });
    setMissing([]);
    setExistingPath(null);
    setMalformedPath(false);
    setError(null);
  };

  const update = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setMissing((current) => current.filter((f) => f !== field));
    if (field === "path") {
      setExistingPath(null);
      setMalformedPath(false);
    }
    setError(null);
  };

  const handleCreate = async () => {
    const invalid = missingFields(values);
    setMissing(invalid);
    if (invalid.length > 0) return;
    const path = values.path.trim();
    if (isMalformedPath(path)) {
      setMalformedPath(true);
      return;
    }
    // Repository paths are case sensitive
    if (existingRepositories.includes(path)) {
      setExistingPath(path);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createMailRepository(encodeURIComponent(path), values.protocol.trim());
      close();
      toast({ title: t("mailRepositories.created") });
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setCreating(false);
    }
  };

  const fieldErrorOf = (field: Field): string | null => {
    if (missing.includes(field)) return t(REQUIRED_KEYS[field]);
    if (field === "path" && malformedPath) return t("mailRepositories.malformedPath");
    if (field === "path" && existingPath !== null) return t("mailRepositories.alreadyExists", { path: existingPath });
    return null;
  };

  const renderField = (field: Field, label: string, options: { placeholder?: string; hint?: string; list?: string } = {}) => {
    const { placeholder, hint, list } = options;
    const fieldError = fieldErrorOf(field);
    const id = `mail-repository-${field}`;
    const hintId = `${id}-hint`;
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={id}>
          {label} <span className="text-red-500">*</span>
        </label>
        <input
          id={id}
          className={`${INPUT_CLASS} ${fieldError ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"}`}
          placeholder={placeholder}
          value={values[field]}
          list={list}
          aria-required
          aria-invalid={fieldError !== null}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => update(field, e.target.value)}
        />
        {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
        {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
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
              {renderField("path", t("mailRepositories.pathLabel"), { placeholder: t("mailRepositories.pathPlaceholder") })}
              {renderField("protocol", t("mailRepositories.protocolLabel"), {
                hint: t("mailRepositories.protocolHint"),
                list: PROTOCOL_SUGGESTIONS_ID,
              })}
              <datalist id={PROTOCOL_SUGGESTIONS_ID}>
                {SUGGESTED_PROTOCOLS.map((protocol) => <option key={protocol} value={protocol} />)}
              </datalist>
              {error !== null && (
                <div role="alert" className="text-sm text-red-600">
                  <p className="font-medium">{t("mailRepositories.createError")}</p>
                  <ErrorDisplayer error={error} />
                </div>
              )}
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
