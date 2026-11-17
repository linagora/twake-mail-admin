import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { useToast } from "@/hooks/use-toast";
import { appConfig } from "@/lib/config";
import { createDomain } from "./api-client";

interface Props {
  // The domains the list already shows: WebAdmin answers 204 to an existing domain too
  existingDomains: readonly string[];
  onCreated: () => void;
}

/** "Create a domain", next to the search of the domain list: the name is typed in a modal. */
export default function CreateDomainButton({ existingDomains, onCreated }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Domain names are case insensitive
  const validateCreate = () => {
    const domain = name.trim();
    const lower = domain.toLowerCase();
    return existingDomains.some((existing) => existing.toLowerCase() === lower) ? t("domains.alreadyExists", { name: domain }) : null;
  };

  const handleCreate = async () => {
    const domain = name.trim();
    await createDomain(domain);
    toast({ title: t("domains.created", { name: domain }) });
    setName("");
    onCreated();
  };

  return (
    <>
      <Button onClick={() => { setName(""); setOpen(true); }}>
        <Plus className="w-4 h-4" aria-hidden="true" />
        {t("domains.createButton")}
      </Button>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("domains.createConfirmTitle")}
        submitLabel={t("common.create")}
        submitDisabled={!name.trim()}
        validate={validateCreate}
        onSubmit={handleCreate}
      >
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t("domains.domainName")}</label>
          <input
            id={fieldId}
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("domains.newDomainPlaceholder")}
            className={FIELD_CLASS}
          />
          <p className="text-xs text-muted-foreground mt-1">{t(appConfig.application === "CALENDAR" ? "domains.createHintCalendar" : "domains.createHint")}</p>
        </div>
      </FormDialog>
    </>
  );
}
