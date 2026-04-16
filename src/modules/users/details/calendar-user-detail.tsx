import { useParams } from "react-router";
import CalendarUserTasks from "./calendar-user-tasks";

export default function CalendarUserDetail() {
  const { username } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">User Details</h3>
      <p>Username: {username}</p>

      <CalendarUserTasks username={username!} />
    </div>
  );
}
