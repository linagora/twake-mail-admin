import { useParams } from "react-router";
import UserMailboxes from "./user-mailboxes";
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

export default function UserDetail() {
  const { username } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">User Details</h3>
      <p>Username: {username}</p>

      <UserMailboxes username={username!} />
      <UserQuota username={username!} />
      <UserAliases username={username!} />
      <UserForwards username={username!} />
      <UserTeamMailboxes username={username!} />
      <UserVacation username={username!} />
      <UserDelegation username={username!} />
      <UserAllowedFrom username={username!} />
      <UserIdentities username={username!} />
      <UserTasks username={username!} />
      <UserChannels username={username!} />
    </div>
  );
}
