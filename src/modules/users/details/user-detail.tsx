import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import UserMailboxes from "./user-mailboxes";
import { MailUserSummary } from "./user-summary";
import UserQuota from "./user-quota";
import UserAliases from "./user-aliases";
import UserForwards from "./user-forwards";
import UserTeamMailboxes from "./user-team-mailboxes";
import UserVacation from "./user-vacation";
import UserDelegation from "./user-delegation";
import UserAllowedFrom from "./user-allowed-from";
import UserIdentities from "./user-identities";
import UserTasks from "./user-tasks";
import UserChannels from "./user-channels";
import UserMappings from "./user-mappings";
import UserDeletedMessageVault from "./user-deleted-message-vault";
import UserLabels from "./user-labels";
import UserJmapSettings from "./user-jmap-settings";
import { UserMappingsRevisionContext, useUserMappingsRevisionState } from "./user-mappings-revision";
import RateLimitsSection from "@/components/custom/rate-limits-section";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getUserRateLimits, updateUserRateLimits, searchDeletedMessages, restoreDeletedMessages } from "../api-client";
import { appConfig } from "@/lib/config";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { ExpandCollapseAll, SectionsProvider } from "@/components/custom/collapsible-section";
import { type AccountState, useAccountState } from "./use-account-state";

/** The page of an address that is no account: what it is, and where to look instead. */
function NoAccount({ username, invalid }: { username: string; invalid: boolean }) {
  const { t } = useTranslation();
  const localPart = username.includes("@") ? username.slice(0, username.lastIndexOf("@")) : username;
  return (
    <div role="alert" className="mt-4 flex gap-2 items-start border-l-4 border-amber-500 bg-amber-50 text-amber-900 p-3 text-sm">
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-1">
        <p>{invalid ? t("users.noAccount.invalid", { username }) : t("users.noAccount.missing", { username })}</p>
        <p className="flex flex-wrap gap-4">
          <Link to={`/users?q=${encodeURIComponent(localPart)}`} className="text-blue-600 hover:underline">{t("users.noAccount.search")}</Link>
          <Link to="/users" className="text-blue-600 hover:underline">{t("users.noAccount.back")}</Link>
        </p>
      </div>
    </div>
  );
}

/** What the page is about: an account, an address without one, or a name that is no address at all. */
function kindKey(account: AccountState): string {
  if (account === "invalid") return "users.noAccount.invalidKind";
  if (account === "missing") return "users.noAccount.kind";
  return "users.detailKind";
}

export default function UserDetail() {
  const { t } = useTranslation();
  const { username } = useParams();
  const canUpdateRateLimits = useIsAllowed("PUT", "/users/{username}/ratelimits");
  const canSearchDeleted = useIsAllowed("POST", "/deletedMessages/users/{username}/messages");
  const canRestoreDeleted = useIsAllowed("POST", "/deletedMessages/users/{username}");

  const breadcrumbs = useBreadcrumbs();
  const mappingsRevision = useUserMappingsRevisionState();
  const fetchRateLimits = useCallback(() => getUserRateLimits(username!), [username]);
  const updateRateLimits = useCallback((limits: any) => updateUserRateLimits(username!, limits), [username]);
  const account = useAccountState(username!);

  return (
    <SectionsProvider page="user">
    <Header
      headerTitle={username}
      headerSubTitle={t(kindKey(account))}
      breadcrumb={breadcrumbs.users()}
      actions={account === "missing" || account === "invalid" ? undefined : <ExpandCollapseAll />}
    />
    {account === "checking" && <div className="h-[58px] mt-4 rounded-2 animate-pulse bg-gray-200" />}
    {(account === "missing" || account === "invalid") && <NoAccount username={username!} invalid={account === "invalid"} />}
    {account === "missing" && (
      // A bare address can still be forwarded and be the source of mappings; nothing else applies
      <>
        <MailUserSummary username={username!} forwardsOnly />
        <div className="mt-4 p-4 bg-white rounded-2">
          <UserMappingsRevisionContext.Provider value={mappingsRevision}>
            <UserForwards username={username!} noMailbox />
            <UserMappings username={username!} />
          </UserMappingsRevisionContext.Provider>
        </div>
      </>
    )}
    {(account === "exists" || account === "unknown") && <>
    <MailUserSummary username={username!} />
    <div className="mt-4 p-4 bg-white rounded-2">

      <UserMailboxes username={username!} />
      <UserQuota username={username!} />
      <UserMappingsRevisionContext.Provider value={mappingsRevision}>
        <UserAliases username={username!} />
        <UserForwards username={username!} />
        <UserMappings username={username!} />
        <UserTeamMailboxes username={username!} />
        <UserVacation username={username!} />
        <UserDelegation username={username!} />
        <UserAllowedFrom username={username!} />
        <UserIdentities username={username!} />
      </UserMappingsRevisionContext.Provider>
      <UserLabels username={username!} />
      {appConfig.application === 'MAIL' && <UserJmapSettings username={username!} />}
      <RateLimitsSection fetchRateLimits={fetchRateLimits} updateRateLimits={updateRateLimits} canUpdate={canUpdateRateLimits} />
      {(canSearchDeleted || canRestoreDeleted) && (
        <UserDeletedMessageVault
          label={username!}
          onSearch={(body) => searchDeletedMessages(username!, body)}
          onRestore={(body) => restoreDeletedMessages(username!, body)}
          canSearch={canSearchDeleted}
          canRestore={canRestoreDeleted}
        />
      )}
      <UserTasks username={username!} />
      <UserChannels username={username!} />
    </div>
    </>}
    </SectionsProvider>
  );
}
