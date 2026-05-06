import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getUserChannels, disconnectUserChannels } from "../api-client";
import { NetworkChannel } from "@/modules/network-channels/types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import ChannelGrid from "@/modules/network-channels/components/channel-grid";

interface Props {
  username: string;
}

export default function UserChannels({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/servers/channels/{username}");
  const canDisconnect = useIsAllowed("DELETE", "/servers/channels/{username}");
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<NetworkChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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
      header: t("users.channels.title"),
      message: t("networkChannels.disconnectUser", { username }),
    });
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await disconnectUserChannels(username);
      toast({ title: t("users.channels.disconnectAll") });
      await fetchChannels();
    } catch (err) {
      toast({
        title: t("users.channels.title"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    if (open) fetchChannels();
  }, [open, fetchChannels]);

  if (!canView) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.channels.title")}
      </button>

      {open && (
        <div className="mt-2">
          <div className="flex justify-end gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={fetchChannels} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            {canDisconnect && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDisconnectAll}
                disabled={disconnecting}
              >
                {disconnecting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("users.channels.disconnectAll")}
              </Button>
            )}
          </div>

          <ChannelGrid channels={channels} loading={loading} />
        </div>
      )}
    </div>
  );
}
