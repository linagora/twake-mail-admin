import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getJmapSettingsReport, JmapSettingsReport } from "./api-client";
import Header from "@/components/custom/header";

export function ReportTable({ report }: { report: JmapSettingsReport }) {
  const { t } = useTranslation();
  const keys = Object.keys(report).sort();

  if (keys.length === 0) {
    return <p className="text-sm text-gray-500">{t("jmapReport.empty")}</p>;
  }

  return (
    <div className="space-y-6">
      {keys.map((key) => {
        const values = report[key];
        const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
        return (
          <div key={key}>
            <h3 className="text-sm font-semibold font-mono text-gray-700 mb-1">{key}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 font-medium">{t("jmapReport.value")}</th>
                  <th className="px-3 py-2 font-medium text-right">{t("jmapReport.users")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([value, count]) => (
                  <tr key={value} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{value}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function JmapSettingsReportPage() {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", "/jmap/settings/reports");

  const fetchReport = useCallback(() => getJmapSettingsReport(), []);
  const { data: report, isLoading, error } = useFetchData<JmapSettingsReport>(
    canView ? fetchReport : null
  );

  if (!canView) return null;

  return (
    <div className="p-4">
      <Header
        headerTitle={t("jmapReport.title")}
        headerSubTitle={t("jmapReport.subtitle")}
        docuUrl=""
      />

      <div className="mt-6 max-w-2xl space-y-4">
        {isLoading && (
          <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {report && <ReportTable report={report} />}
      </div>
    </div>
  );
}
