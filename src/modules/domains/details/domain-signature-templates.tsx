import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import {
  SignatureTemplate,
  getDomainSignatureTemplates,
  updateDomainSignatureTemplates,
  deleteDomainSignatureTemplates,
} from "../api-client";

interface Props {
  domain: string;
}

const EMPTY_TEMPLATE: SignatureTemplate = { language: "", textSignature: "", htmlSignature: "" };

export default function DomainSignatureTemplates({ domain }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/signature-templates");
  const canEdit = useIsAllowed("PUT", "/domains/{domain}/signature-templates");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/signature-templates");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SignatureTemplate[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDomainSignatureTemplates(domain);
      setTemplates(data);
      setDirty(false);
    } catch (err: any) {
      setError(err?.message || t("domains.signatureTemplates.empty"));
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  if (!canView) return null;

  const handleChange = (index: number, field: keyof SignatureTemplate, value: string) => {
    setTemplates(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
    setDirty(true);
  };

  const handleAdd = () => {
    setTemplates(prev => [...prev, { ...EMPTY_TEMPLATE }]);
    setExpandedIndex(templates.length);
    setDirty(true);
  };

  const handleRemove = (index: number) => {
    setTemplates(prev => prev.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
    setDirty(true);
  };

  const handleSave = async () => {
    if (templates.some(tpl => !tpl.language.trim())) {
      toast({ title: t("domains.signatureTemplates.languageCode") });
      return;
    }
    setSaving(true);
    try {
      await updateDomainSignatureTemplates(domain, templates);
      toast({ title: t("domains.signatureTemplates.saved") });
      setDirty(false);
    } catch (err) {
      toast({ title: t("domains.signatureTemplates.errorSaving"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = await confirm({
      header: t("domains.signatureTemplates.deleteAllTitle"),
      message: t("domains.signatureTemplates.deleteAllConfirm", { domain }),
    });
    if (!confirmed) return;
    try {
      await deleteDomainSignatureTemplates(domain);
      toast({ title: t("domains.signatureTemplates.deleted") });
      setTemplates([]);
      setDirty(false);
    } catch (err) {
      toast({ title: t("domains.signatureTemplates.errorDeleting"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("domains.signatureTemplates.title")}
          {!loading && (
            <span className="text-sm font-normal text-gray-500">({templates.length})</span>
          )}
        </button>
        {open && canEdit && (
          <button
            onClick={handleAdd}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.signatureTemplates.languageCode")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {loading && (
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500 text-sm">Error: {error}</p>}

          {!loading && templates.length === 0 && (
            <p className="text-sm text-gray-500">{t("domains.signatureTemplates.empty")}</p>
          )}

          {templates.map((tpl, index) => (
            <div key={index} className="bg-gray-50 rounded-2 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  {expandedIndex === index
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                  <span className="font-mono">{tpl.language || <em className="text-gray-400">{t("domains.signatureTemplates.newTemplate")}</em>}</span>
                </button>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-1 rounded-md hover:bg-gray-200"
                    title={t("domains.signatureTemplates.deleteAll")}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>

              {expandedIndex === index && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{t("domains.signatureTemplates.languageCode")}</label>
                    <input
                      type="text"
                      value={tpl.language}
                      onChange={e => handleChange(index, "language", e.target.value)}
                      placeholder={t("domains.signatureTemplates.languagePlaceholder")}
                      disabled={!canEdit}
                      className="w-40 px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{t("domains.signatureTemplates.textSignature")}</label>
                    <textarea
                      value={tpl.textSignature}
                      onChange={e => handleChange(index, "textSignature", e.target.value)}
                      rows={4}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{t("domains.signatureTemplates.htmlSignature")}</label>
                    <textarea
                      value={tpl.htmlSignature}
                      onChange={e => handleChange(index, "htmlSignature", e.target.value)}
                      rows={6}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {(canEdit || canDelete) && (
            <div className="flex gap-2 pt-1">
              {canEdit && dirty && (
                <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-sm">
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? t("domains.signatureTemplates.saving") : t("domains.signatureTemplates.saveChanges")}
                </Button>
              )}
              {canDelete && templates.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteAll}
                  className="rounded-sm"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t("domains.signatureTemplates.deleteAll")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
