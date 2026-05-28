import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getJmapSettingsReport, JmapSettingsReport } from "@/modules/jmap-settings-report/api-client";
import { ReportTable } from "@/modules/jmap-settings-report";

interface Props {
  domain: string;
}

export default function DomainJmapReport({ domain }: Props) {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", "/jmap/settings/reports");
  const [open, setOpen] = useState(false);

  const fetchReport = useCallback(
    () => getJmapSettingsReport(domain),
    [domain]
  );
  const { data: report, isLoading, error } = useFetchData<JmapSettingsReport>(
    open && canView ? fetchReport : null
  );

  if (!canView) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("jmapReport.sectionTitle")}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500 text-sm mt-2">Error: {error}</p>}
          {report && <ReportTable report={report} />}
        </div>
      )}
    </div>
  );
}
