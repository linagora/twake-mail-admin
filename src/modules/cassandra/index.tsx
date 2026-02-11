import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getCassandraVersion, getCassandraLatestVersion, upgradeCassandraToLatest, CassandraVersion } from "./api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";

const headerSubTitle = "Cassandra schema version management";
const docuUrl = "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_cassandra_schema_upgrades";

export default function Cassandra() {
  const { toast } = useToast();
  const confirm = useConfirm();
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
      header: "Upgrade Cassandra Schema",
      message: `Upgrade schema from version ${data?.current.version} to version ${data?.latest.version}? This will schedule migration tasks.`,
    });
    if (!confirmed) return;

    setUpgrading(true);
    try {
      const result = await upgradeCassandraToLatest();
      toast({
        title: "Upgrade scheduled",
        description: (
          <span>
            Task started:{" "}
            <a href={`/task/${result.taskId}`} className="underline text-blue-600">
              {result.taskId}
            </a>
          </span>
        ),
      });
      await refresh();
    } catch (err) {
      toast({
        title: "Error upgrading schema",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="p-4 w-fit">
      <Header headerSubTitle={headerSubTitle} docuUrl={docuUrl} />

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
              <span className="text-sm text-gray-600">Current schema version</span>
              <strong className="text-sm">{data.current.version}</strong>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-600">Latest available version</span>
              <strong className="text-sm">{data.latest.version}</strong>
            </div>

            <hr className="border-gray-200" />

            {isUpToDate ? (
              <Button disabled className="rounded-sm opacity-50 cursor-not-allowed">
                Already at latest version
              </Button>
            ) : (
              <Button
                className="bg-blue-500 hover:bg-blue-600 rounded-sm"
                onClick={handleUpgrade}
                disabled={upgrading}
              >
                {upgrading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Upgrade to version {data.latest.version}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
