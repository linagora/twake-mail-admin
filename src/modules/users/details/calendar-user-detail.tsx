import { useCallback, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, UserPlus } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { createRegisteredUser, getRegisteredUsers } from "@/modules/registered-users/api-client";
import { RegisteredUser } from "@/modules/registered-users/types";
import { defaultRegisteredUserNames, validateRegisteredUserNames } from "@/modules/registered-users/validation";
import { RegisterUserForm } from "@/modules/registered-users/register-user-form";
import { Button } from "@/components/ui/button";
import CalendarUserTasks from "./calendar-user-tasks";
import { CalendarUserSummary } from "./user-summary";
import UserCalendars from "./user-calendars";
import UserBookingLinks from "./user-booking-links";
import UserAddressBooks from "./user-address-books";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { ExpandCollapseAll, SectionsProvider } from "@/components/custom/collapsible-section";
import { useRegisteredUsersPermissions } from "@/modules/registered-users/permissions";

function UnregisteredUser({ username, onRegistered }: { username: string; onRegistered: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const domain = useDomain() || undefined;
  const { create: canRegister } = useRegisteredUsersPermissions();

  const handleRegister = async () => {
    const defaults = defaultRegisteredUserNames(username);
    let values = { ...defaults };

    await confirm({
      header: t("users.registration.registerTitle"),
      message: (
        <RegisterUserForm
          username={username}
          defaults={defaults}
          onChange={(v) => { values = v; }}
        />
      ),
      validate: () => validateRegisteredUserNames(values, t),
      action: async () => {
        await createRegisteredUser({ id: username, email: username, ...values }, domain);
        toast({ title: t("users.registration.registered", { username }) });
        onRegistered();
      },
    });
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-4 p-8 bg-amber-50 border border-amber-200 rounded-md text-center">
      <AlertTriangle className="w-10 h-10 text-amber-600" />
      <h4 className="text-lg font-semibold text-amber-900">{t("users.registration.notRegistered")}</h4>
      <p className="text-sm text-amber-800 max-w-xl">{t("users.registration.notRegisteredHint")}</p>
      {canRegister && (
        <Button size="lg" onClick={handleRegister}>
          <UserPlus className="w-5 h-5 mr-2" />
          {t("users.registration.register")}
        </Button>
      )}
    </div>
  );
}

export default function CalendarUserDetail() {
  const { username } = useParams();
  const { t } = useTranslation();

  const domain = useDomain() || undefined;
  const { read: canReadRegisteredUsers } = useRegisteredUsersPermissions();
  const fetchRegisteredUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const { data: registeredUsers, error, refresh } = useFetchData<RegisteredUser[]>(
    canReadRegisteredUsers ? fetchRegisteredUsers : null
  );

  // The registration state is unknown while the list loads, and stays unknown when it cannot be
  // read: in that case the details are rendered as-is, letting each panel report its own errors.
  const pending = canReadRegisteredUsers && registeredUsers === null && !error;
  const registeredUser = registeredUsers?.find((u) => (u.email ?? "").toLowerCase() === username!.toLowerCase());
  const isRegistered = registeredUsers === null || !!registeredUser;
  const breadcrumbs = useBreadcrumbs();
  // Who the user is and whether they have calendars, from the record the page already loads
  const fullName = [registeredUser?.firstname, registeredUser?.lastname].filter(Boolean).join(" ");
  const status = pending || registeredUsers === null
    ? undefined
    : registeredUser
      ? [fullName, t("users.registration.registeredLine")].filter(Boolean).join(" · ")
      : t("users.registration.notRegisteredLine");
  // The booking links show the name of their calendar: they re-read the calendars once the
  // Calendars section changed them.
  const [calendarsVersion, setCalendarsVersion] = useState(0);

  return (
    <SectionsProvider page="user">
    <Header headerTitle={username} headerSubTitle={status ?? t("users.detailKind")} breadcrumb={breadcrumbs.users()} actions={<ExpandCollapseAll />} />
    {isRegistered && <CalendarUserSummary />}
    <div className="mt-4 p-4 bg-white rounded-2">

      {pending && <div className="h-[58px] mt-4 rounded-2 animate-pulse bg-gray-200" />}

      {!pending && !isRegistered && (
        <UnregisteredUser username={username!} onRegistered={refresh} />
      )}

      {!pending && isRegistered && (
        <>
          <UserCalendars username={username!} onCalendarsChanged={() => setCalendarsVersion((v) => v + 1)} defaultOpen />
          <UserAddressBooks username={username!} defaultOpen />
          <UserBookingLinks username={username!} calendarsVersion={calendarsVersion} />
          <CalendarUserTasks username={username!} />
        </>
      )}
    </div>
    </SectionsProvider>
  );
}
