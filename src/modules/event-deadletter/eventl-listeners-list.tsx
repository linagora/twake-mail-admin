import { RefreshCw, Trash2 } from "lucide-react";
import { ListenerGroupsResponseType } from "./types";
import {
  getMailboxListenerGroups,
  deleteAllEventsForGroup,
  redeliverGroupEvents,
} from "./api-client";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";

export default function EventListenersList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  let {
    data: listenerGroupsResult,
    isLoading,
    error: _error,
  } = useFetchData<ListenerGroupsResponseType>(getMailboxListenerGroups);

  // REMOVE
  const mailRepositoriesResultMocked = [
    ...(listenerGroupsResult || []),
    "org.apache.james.mailbox.events.EventBusTestFixture$GroupA",
    "org.apache.james.mailbox.events.GenericGroup-abc",
  ];
  // REMOVE
  listenerGroupsResult = mailRepositoriesResultMocked;

  const [_isLoadingInfo, _setIsLoadingInfo] = useState<boolean>(false);
  const [_errorInfo, _setErrorInfo] = useState<string | null>(null);

  const handleRedeliverGroup = async (path: string) => {
    const result = await confirm({
      header: "Run Task",
      message: `Do you want to re-deliver events for the group: ${path}.`,
    });
    if (!result) {
      return;
    }
    const { taskId } = await redeliverGroupEvents(path);
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
  const handleClearGroup = async (path: string) => {
    const result = await confirm({
      header: "Run Task",
      message: `Do you want to clear group: ${path}.`,
    });
    if (!result) {
      return;
    }
    await deleteAllEventsForGroup(path);
    toast({
      title: "Run Task Successfully",
      description: <p>The events were deleted.</p>,
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
        <p>List</p>
        <div>
          {listenerGroupsResult?.map((result) => (
            <div
              key={result}
              className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
            >
              <div>
                <h4 className="text-sm font-medium leading-none">
                  <a
                    href={`/event-dead-letter/group/${result}?&page=1&size=10`}
                  >
                    {result} (0)
                  </a>
                </h4>
              </div>

              <div className="flex gap-2">
                <button
                  className="p-2 rounded-md hover:bg-gray-200"
                  onClick={() => {
                    handleRedeliverGroup(result);
                  }}
                >
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </button>

                <button
                  className="p-2 rounded-md hover:bg-gray-200"
                  onClick={() => {
                    handleClearGroup(result);
                  }}
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
