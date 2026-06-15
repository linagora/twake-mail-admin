import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import CalendarUserTasks from "./calendar-user-tasks";
import UserCalendars from "./user-calendars";

export default function CalendarUserDetail() {
  const { username } = useParams();
  const { t } = useTranslation();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">{t("users.title")}</h3>
      <p>{t("users.label", { username })}</p>

      <UserCalendars username={username!} />
      <CalendarUserTasks username={username!} />
    </div>
  );
}
