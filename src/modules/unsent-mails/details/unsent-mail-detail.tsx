import { useCallback, useState } from "react";
import { useParams } from "react-router";
import { RefreshCw, Trash2, Download, Clock, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { getUnsentMail, deleteUnsentMail, resendUnsentMail, downloadUnsentMail } from "../api-client";
import type { UnsentMail } from "../types";

export default function UnsentMailDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { id } = useParams();
  const canResend = useIsAllowed("POST", "/unsentMails/{id}");
  const canDelete = useIsAllowed("DELETE", "/unsentMails/{id}");

  const fetchMail = useCallback(() => getUnsentMail(id!), [id]);
  const { data: mail, isLoading, error } = useFetchData<UnsentMail>(fetchMail);

  const [showBody, setShowBody] = useState(false);

  const handleResend = async () => {
    const confirmed = await confirm({
      header: t("unsentMails.resendTitle"),
      message: t("unsentMails.resendConfirm", { id }),
    });
    if (!confirmed) return;
    try {
      const { taskId } = await resendUnsentMail(id!);
      toast({
        title: t("unsentMails.taskSubmitted"),
        description: `Task ${taskId}`,
      });
    } catch (err) {
      toast({ title: t("unsentMails.errorResending"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      header: t("unsentMails.deleteTitle"),
      message: t("unsentMails.deleteConfirm", { id }),
    });
    if (!confirmed) return;
    try {
      await deleteUnsentMail(id!);
      toast({ title: t("unsentMails.deleted") });
    } catch (err) {
      toast({ title: t("unsentMails.errorDeleting"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleDownload = async () => {
    try {
      await downloadUnsentMail(id!);
    } catch (err) {
      toast({ title: t("unsentMails.errorDownloading"), description: <ErrorDisplayer error={err} /> });
    }
  };

  if (isLoading) return <p className="mt-4 text-gray-500">{t("common.loading")}</p>;
  if (error) return <p className="mt-4 text-red-500">{error}</p>;
  if (!mail) return null;

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">{t("unsentMails.detailTitle")}</h3>
          <p className="text-sm text-gray-500 mt-1">{mail.id}</p>
        </div>
        <div className="flex gap-2">
          {canResend && (
            <button
              className="p-2 rounded-md hover:bg-gray-200"
              title={t("unsentMails.resendTooltip")}
              onClick={handleResend}
            >
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </button>
          )}
          <button
            className="p-2 rounded-md hover:bg-gray-200"
            title={t("unsentMails.downloadTooltip")}
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 text-blue-600" />
          </button>
          {canDelete && (
            <button
              className="p-2 rounded-md hover:bg-gray-200"
              title={t("unsentMails.deleteTooltip")}
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
        <div>
          <dt className="font-medium text-gray-600">{t("unsentMails.sender")}</dt>
          <dd>{mail.mailFrom ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">{t("unsentMails.recipient")}</dt>
          <dd>{mail.rcptTo.join(", ")}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">{t("unsentMails.date")}</dt>
          <dd>{new Date(mail.createdAt).toLocaleString()}</dd>
        </div>
      </dl>

      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">{t("unsentMails.sendingTrials")}</h4>
        {mail.sendingTrials.length === 0 ? (
          <p className="text-sm text-gray-400">{t("unsentMails.noTrials")}</p>
        ) : (
          <ol className="space-y-2">
            {mail.sendingTrials.map((trial, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {index < mail.sendingTrials.length - 1 && (
                    <div className="w-px h-4 bg-gray-200" />
                  )}
                </div>
                <div>
                  <p className="text-gray-600">
                    {new Date(trial.date).toLocaleString()}
                  </p>
                  <p className="text-red-600 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    {trial.errorMessage}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowBody((s) => !s)}
          className="text-sm text-blue-500 hover:underline"
        >
          {showBody ? t("unsentMails.hideContent") : t("unsentMails.showContent")}
        </button>
        {showBody && (
          <pre className="mt-2 p-3 bg-gray-50 rounded-md overflow-auto text-xs whitespace-pre-wrap break-words max-h-96">
            {mail.body}
          </pre>
        )}
      </div>
    </div>
  );
}
