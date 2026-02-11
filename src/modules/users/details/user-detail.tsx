import { useParams } from "react-router";
import UserMailboxes from "./user-mailboxes";
import UserQuota from "./user-quota";
import UserAliases from "./user-aliases";
import UserTasks from "./user-tasks";

export default function UserDetail() {
  const { username } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">User Details</h3>
      <p>Username: {username}</p>

      <UserMailboxes username={username!} />
      <UserQuota username={username!} />
      <UserAliases username={username!} />
      <UserTasks username={username!} />
    </div>
  );
}
