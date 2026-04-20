import { MoveHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react";
import { GetMailRepositoriesResponseType, MailRepository } from "./types";
import {
  clearMailRepository,
  createMailRepository,
  getMailRepositories,
  getRepositoryInfo,
  moveAllMails,
  reprocessMailRepository,
} from "./api-client";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import ConfirmTaskContent from "../common-tasks/components/confirm-task-content";

function CreateMailRepositoryForm({
  onChange,
}: {
  onChange: (field: "path" | "protocol", value: string) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1">
        <label className="text-sm font-medium">Repository path <span className="text-red-500">*</span></label>
        <input
          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. mailRepo"
          onChange={(e) => onChange("path", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Protocol <span className="text-red-500">*</span></label>
        <input
          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue="cassandra"
          onChange={(e) => onChange("protocol", e.target.value)}
        />
      </div>
    </div>
  );
}

export default function MailRepositoriesList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const canCreate = useIsAllowed("PUT", "/mailRepositories/{encodedPath}");
  const canReprocess = useIsAllowed("PATCH", "/mailRepositories/{encodedPath}/mails");
  const canMove = useIsAllowed("PATCH", "/mailRepositories/{encodedPath}/mails");
  const canClear = useIsAllowed("DELETE", "/mailRepositories/{encodedPath}/mails");
  const {
    data: mailRepositoriesResult,
    isLoading,
    refresh,
  } = useFetchData<GetMailRepositoriesResponseType>(getMailRepositories);

  const [repositoriesWithSize, setRepositoriesWithSize] = useState<
    (MailRepository & { size: number })[]
  >([]);
  const [, setIsLoadingInfo] = useState<boolean>(false);
  const [, setErrorInfo] = useState<string | null>(null);

  const fetchRepositoryInfo = useCallback(async () => {
    if (!mailRepositoriesResult) return;

    setIsLoadingInfo(true);
    const updatedRepositories = await Promise.all(
      mailRepositoriesResult.map(async (repository) => {
        try {
          const repoInfo = await getRepositoryInfo(repository.path);
          return { ...repository, size: repoInfo.size };
        } catch {
          setErrorInfo(`Failed to fetch info for ${repository.repository}`);
          return { ...repository, size: 0 }; // Handle the error case, e.g., set size to 0 or keep existing data
        }
      })
    );
    setRepositoriesWithSize(updatedRepositories);
    setIsLoadingInfo(false);
  }, [mailRepositoriesResult]);

  // Trigger the fetch when mailRepositoriesResult is available
  useEffect(() => {
    if (mailRepositoriesResult) {
      fetchRepositoryInfo();
    }
  }, [mailRepositoriesResult, fetchRepositoryInfo]);

  const handleReprocessTask = async (path: string) => {
    const params = [
      { key: "queue", defaultValue: "spool", type: "input" as const }, // Target mail queue
      { key: "processor", defaultValue: "root", type: "input" as const }, // Override state of reprocessing mails
      { key: "consume", defaultValue: true, type: "checkbox" as const }, // Non-destructive reprocessing option
      { key: "limit", defaultValue: "", type: "input" as const }, // Limit count of elements
      { key: "maxRetries", defaultValue: "", type: "input" as const }, // Limit retries
    ];
    const paramValues: { [key: string]: string } = {};
    const command =
      "curl -XPATCH http://ip:port/mailRepositories/{encodedPathOfTheRepository}/mails?action=reprocess&";
    const result = await confirm({
      header: "Run Task",
      message: (
        <ConfirmTaskContent
          message={<p>Do you want to run task <b>Reprocess Mail Repository</b>?</p>}
          command={command}
          params={params}
          getParamValues={(key, value) => {
            paramValues[key] =
              typeof value === "boolean" ? value.toString() : value;
          }}
        />
      ),
    });
    if (!result) {
      return;
    }
    const { taskId } = await reprocessMailRepository(path, paramValues);
    toast({
      title: "Run Task Successfully",
      description: (
        <p>
          Task{" "}
          <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>
            {taskId}
          </a>
        </p>
      ),
    });
  };
  const handleCreateRepository = async () => {
    const values = { path: "", protocol: "cassandra" };
    const result = await confirm({
      header: "Create Mail Repository",
      message: (
        <CreateMailRepositoryForm
          onChange={(field, value) => {
            values[field] = value;
          }}
        />
      ),
    });
    if (!result) return;
    if (!values.path || !values.protocol) {
      toast({ title: "Repository path and protocol are required", variant: "destructive" });
      return;
    }
    await createMailRepository(
      encodeURIComponent(values.path),
      values.protocol
    );
    toast({ title: "Mail repository created successfully" });
    refresh();
  };

  const handleMoveAll = async (sourcePath: string) => {
    const otherRepos = repositoriesWithSize.filter((r) => r.path !== sourcePath);
    if (otherRepos.length === 0) {
      toast({ title: "No other repositories available to move mails to" });
      return;
    }
    let targetRepo = otherRepos[0].path;
    const result = await confirm({
      header: "Move All Mails",
      message: (
        <div className="space-y-2 py-2">
          <p className="text-sm">
            Move all mails from <b>{sourcePath}</b> to:
          </p>
          <select
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue={otherRepos[0].path}
            onChange={(e) => {
              targetRepo = e.target.value;
            }}
          >
            {otherRepos.map((r) => (
              <option key={r.path} value={r.path}>
                {r.repository} ({r.path})
              </option>
            ))}
          </select>
        </div>
      ),
    });
    if (!result) return;
    try {
      await moveAllMails(encodeURIComponent(sourcePath), targetRepo);
      toast({ title: "All mails moved successfully" });
      refresh();
    } catch (err: any) {
      toast({
        title: "Error moving mails",
        description: err?.response?.data?.message || err?.message || "Failed to move mails",
      });
    }
  };

  const handleClearTask = async (path: string) => {
    const result = await confirm({
      header: "Run Task",
      message: `Do you want to clear the mail repository: ${path}.`,
    });
    if (!result) {
      return;
    }
    const { taskId } = await clearMailRepository(path);
    toast({
      title: "Run Task Successfully",
      description: (
        <p>
          Task{" "}
          <a className="text-blue-500 hover:underline" href={`/task/${taskId}`}>
            {taskId}
          </a>
        </p>
      ),
    });
  };
  return (
    <>
      <div>
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        <div className="flex items-center justify-between mt-4">
          <p>List</p>
          {canCreate && (
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
              onClick={handleCreateRepository}
            >
              <Plus className="w-4 h-4" />
              New repository
            </button>
          )}
        </div>
        <div>
          {repositoriesWithSize?.map((result) => (
            <div
              key={result.repository}
              className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
            >
              <div>
                <h4 className="text-sm font-medium leading-none">
                  <a
                    href={`/mail-repositories/repository/${result.path}?&page=1&size=${result.size}`}
                  >
                    {result.repository} ({result.size})
                  </a>
                </h4>
                <p className="text-sm text-muted-foreground">{result.path}</p>
              </div>

              <div className="flex gap-2">
                {canReprocess && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200"
                    title="Reprocess all mails"
                    onClick={() => {
                      handleReprocessTask(result.path);
                    }}
                  >
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </button>
                )}

                {canMove && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200"
                    title="Move all mails to another repository"
                    onClick={() => {
                      handleMoveAll(result.path);
                    }}
                  >
                    <MoveHorizontal className="w-5 h-5 text-orange-500" />
                  </button>
                )}

                {canClear && (
                  <button
                    className="p-2 rounded-md hover:bg-gray-200"
                    title="Clear all mails"
                    onClick={() => {
                      handleClearTask(result.path);
                    }}
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
