import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { getUserChannels, disconnectUserChannels } from "../api-client";
import { NetworkChannel } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

export default function UserChannels({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<NetworkChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<NetworkChannel | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserChannels(username);
      setChannels(data);
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [username]);

  const handleDisconnectAll = async () => {
    const confirmed = await confirm({
      header: "Disconnect All Channels",
      message: `Disconnect all channels for "${username}"?`,
    });
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await disconnectUserChannels(username);
      toast({ title: "All channels disconnected" });
      await fetchChannels();
    } catch (err) {
      toast({
        title: "Error disconnecting channels",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    if (open) fetchChannels();
  }, [open, fetchChannels]);

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Network Channels
      </button>

      {open && (
        <div className="mt-2">
          <div className="flex justify-end gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={fetchChannels} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDisconnectAll}
              disabled={disconnecting}
            >
              {disconnecting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Disconnect all
            </Button>
          </div>

          {loading && channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active channels.</p>
          ) : (
            <div className="space-y-1">
              {channels.map((channel, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-2 cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => setSelectedChannel(channel)}
                >
                  <span className="text-sm text-muted-foreground w-8">{index + 1}.</span>
                  <span className="font-mono text-sm">{channel.remoteAddress}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{channel.protocol}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selectedChannel} onOpenChange={(v) => !v && setSelectedChannel(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Channel — {selectedChannel?.remoteAddress}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
            {JSON.stringify(selectedChannel, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
