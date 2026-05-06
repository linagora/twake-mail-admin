import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Save, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getUserVacation, updateUserVacation, deleteUserVacation } from "../api-client";
import { VacationSettings } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  username: string;
}

const EMPTY_VACATION: VacationSettings = {
  enabled: false,
  fromDate: "",
  toDate: "",
  subject: "",
  textBody: "",
  htmlBody: "",
};

export default function UserVacation({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/vacation/{username}");
  const canSave = useIsAllowed("POST", "/vacation/{username}");
  const canDelete = useIsAllowed("DELETE", "/vacation/{username}");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VacationSettings>(EMPTY_VACATION);

  const fetchVacation = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserVacation(username);
      setForm({
        enabled: data.enabled ?? false,
        fromDate: data.fromDate ?? "",
        toDate: data.toDate ?? "",
        subject: data.subject ?? "",
        textBody: data.textBody ?? "",
        htmlBody: data.htmlBody ?? "",
      });
    } catch {
      setForm(EMPTY_VACATION);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (open) fetchVacation();
  }, [open, fetchVacation]);

  if (!canView) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserVacation(username, form);
      toast({ title: t("users.vacation.updated") });
    } catch (err) {
      toast({
        title: t("users.vacation.errorUpdating"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      header: t("users.vacation.deleteTitle"),
      message: t("users.vacation.deleteConfirm", { username }),
    });
    if (!confirmed) return;

    try {
      await deleteUserVacation(username);
      toast({ title: t("users.vacation.deleted") });
      setForm(EMPTY_VACATION);
    } catch (err) {
      toast({
        title: t("users.vacation.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const update = (field: keyof VacationSettings, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.vacation.title")}
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-gray-50 rounded-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="vacation-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => update("enabled", !!v)}
                />
                <label htmlFor="vacation-enabled" className="text-sm font-medium cursor-pointer select-none">
                  {t("users.vacation.enabled")}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t("users.vacation.from")}</label>
                  <input
                    type="datetime-local"
                    value={form.fromDate ? form.fromDate.slice(0, 16) : ""}
                    onChange={(e) => update("fromDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("users.vacation.to")}</label>
                  <input
                    type="datetime-local"
                    value={form.toDate ? form.toDate.slice(0, 16) : ""}
                    onChange={(e) => update("toDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">{t("users.vacation.subject")}</label>
                <input
                  type="text"
                  value={form.subject ?? ""}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder={t("users.vacation.subjectPlaceholder")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t("users.vacation.textBody")}</label>
                <textarea
                  value={form.textBody ?? ""}
                  onChange={(e) => update("textBody", e.target.value)}
                  rows={3}
                  placeholder={t("users.vacation.textPlaceholder")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t("users.vacation.htmlBody")}</label>
                <textarea
                  value={form.htmlBody ?? ""}
                  onChange={(e) => update("htmlBody", e.target.value)}
                  rows={3}
                  placeholder={t("users.vacation.htmlPlaceholder")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t("common.delete")}
                  </Button>
                )}
                {canSave && (
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                    {t("common.save")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
