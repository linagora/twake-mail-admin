import { useCallback, useState } from "react";
import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getCassandraVersion, getCassandraLatestVersion, upgradeCassandraToLatest, CassandraVersion } from "./api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_cassandra_schema_upgrades";

export default function Cassandra() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canUpgrade = useIsAllowed("POST", "/cassandra/version/upgrade/latest");
  const [upgrading, setUpgrading] = useState(false);

  const fetchVersions = useCallback(async () => {
    const [current, latest] = await Promise.all([
      getCassandraVersion(),
      getCassandraLatestVersion(),
    ]);
    return { current, latest };
  }, []);

  const { data, isLoading, error, refresh } = useFetchData<{
    current: CassandraVersion;
    latest: CassandraVersion;
  }>(fetchVersions);

  const isUpToDate = data ? data.current.version >= data.latest.version : false;

  const handleUpgrade = async () => {
    const confirmed = await confirm({
      header: t("cassandra.upgradeTitle"),
      message: t("cassandra.upgradeConfirm", { current: data?.current.version, latest: data?.latest.version }),
    });
    if (!confirmed) return;

    setUpgrading(true);
    try {
      const result = await upgradeCassandraToLatest();
      toast({
        title: t("cassandra.upgradeScheduled"),
        description: (
          <span>
            {t("common.taskStarted")}{" "}
            <Link to={`/task/${result.taskId}`} className="underline text-blue-600">
              {result.taskId}
            </Link>
          </span>
        ),
      });
      await refresh();
    } catch (err) {
      toast({
        title: t("cassandra.errorUpgrading"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="p-4 w-fit">
      <Header headerTitle={t("cassandra.title")} headerSubTitle={t("cassandra.subtitle")} docuUrl={docuUrl} />

      <div className="mt-4">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {data && (
          <div className="p-4 bg-gray-50 rounded-2 space-y-4">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-600">{t("cassandra.currentVersion")}</span>
              <strong className="text-sm">{data.current.version}</strong>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-600">{t("cassandra.latestVersion")}</span>
              <strong className="text-sm">{data.latest.version}</strong>
            </div>

            <hr className="border-gray-200" />

            {isUpToDate ? (
              <Button disabled className="rounded-sm opacity-50 cursor-not-allowed">
                {t("cassandra.alreadyLatest")}
              </Button>
            ) : canUpgrade ? (
              <Button
                className="bg-blue-500 hover:bg-blue-600 rounded-sm"
                onClick={handleUpgrade}
                disabled={upgrading}
              >
                {upgrading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("cassandra.upgradeButton", { version: data.latest.version })}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
