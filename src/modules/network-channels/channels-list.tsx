import { useState, useCallback } from "react";
import { Loader2, RefreshCw, Map } from "lucide-react";
import { useNavigate } from "react-router";
import { getAllChannels, disconnectAllChannels } from "./api-client";
import { NetworkChannel } from "./types";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import ChannelGrid from "./components/channel-grid";

export default function ChannelsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fetchAll = useCallback(() => getAllChannels(), []);
  const { data, isLoading, refresh } = useFetchData<NetworkChannel[]>(fetchAll);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnectAll = async () => {
    const confirmed = await confirm({
      header: "Disconnect All Users",
      message: "Disconnect all user channels on the server? This will close every active connection.",
    });
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await disconnectAllChannels();
      toast({ title: "All users disconnected successfully" });
      refresh();
    } catch (err) {
      toast({
        title: "Error disconnecting all users",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/network-channels/map")}>
          <Map className="w-4 h-4 mr-1" /> Map
        </Button>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <Button
          className="bg-orange-500 hover:bg-orange-600 rounded-sm"
          size="sm"
          onClick={handleDisconnectAll}
          disabled={disconnecting}
        >
          {disconnecting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Disconnect all users
        </Button>
      </div>

      <ChannelGrid channels={data ?? []} paginate loading={isLoading} />
    </div>
  );
}
