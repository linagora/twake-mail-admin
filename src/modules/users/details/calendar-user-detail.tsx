import { useCallback, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, UserPlus } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { createRegisteredUser, getRegisteredUsers } from "@/modules/registered-users/api-client";
import { RegisteredUser } from "@/modules/registered-users/types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import CalendarUserTasks from "./calendar-user-tasks";
import UserCalendars from "./user-calendars";
import UserBookingLinks from "./user-booking-links";
import UserAddressBooks from "./user-address-books";

// The DAV APIs do not expose the directory (LDAP) firstname/lastname, so the admin is asked for them.
function RegisterUserForm({
  username,
  defaults,
  onChange,
}: {
  username: string;
  defaults: { firstname: string; lastname: string };
  onChange: (data: { firstname: string; lastname: string }) => void;
}) {
  const { t } = useTranslation();
  const [firstname, setFirstname] = useState(defaults.firstname);
  const [lastname, setLastname] = useState(defaults.lastname);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{t("users.registration.registerHint", { username })}</p>
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{t("registeredUsers.ldapWarning")}</span>
      </div>
      <div>
        <label className="text-sm font-medium">{t("registeredUsers.firstname")}</label>
        <input
          type="text"
          value={firstname}
          onChange={(e) => { setFirstname(e.target.value); onChange({ firstname: e.target.value, lastname }); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{t("registeredUsers.lastname")}</label>
        <input
          type="text"
          value={lastname}
          onChange={(e) => { setLastname(e.target.value); onChange({ firstname, lastname: e.target.value }); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

function UnregisteredUser({ username, onRegistered }: { username: string; onRegistered: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const domain = useDomain() || undefined;
  const canRegister = useIsAllowed("POST", "/registeredUsers");
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegister = async () => {
    const defaults = { firstname: username.split("@")[0] || "", lastname: "" };
    let values = { ...defaults };

    const confirmed = await confirm({
      header: t("users.registration.registerTitle"),
      message: (
        <RegisterUserForm
          username={username}
          defaults={defaults}
          onChange={(v) => { values = v; }}
        />
      ),
    });
    if (!confirmed) return;

    setIsRegistering(true);
    try {
      await createRegisteredUser({ id: username, email: username, ...values }, domain);
      toast({ title: t("users.registration.registered", { username }) });
      onRegistered();
    } catch (err) {
      toast({
        title: t("users.registration.errorRegistering"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-4 p-8 bg-amber-50 border border-amber-200 rounded-md text-center">
      <AlertTriangle className="w-10 h-10 text-amber-600" />
      <h4 className="text-lg font-semibold text-amber-900">{t("users.registration.notRegistered")}</h4>
      <p className="text-sm text-amber-800 max-w-xl">{t("users.registration.notRegisteredHint")}</p>
      {canRegister && (
        <Button size="lg" onClick={handleRegister} disabled={isRegistering}>
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
  const canReadRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const fetchRegisteredUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const { data: registeredUsers, error, refresh } = useFetchData<RegisteredUser[]>(
    canReadRegisteredUsers ? fetchRegisteredUsers : null
  );

  // The registration state is unknown while the list loads, and stays unknown when it cannot be
  // read: in that case the details are rendered as-is, letting each panel report its own errors.
  const pending = canReadRegisteredUsers && registeredUsers === null && !error;
  const isRegistered =
    registeredUsers === null ||
    registeredUsers.some((u) => (u.email ?? "").toLowerCase() === username!.toLowerCase());

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">{t("users.title")}</h3>
      <p>{t("users.label", { username })}</p>

      {pending && <div className="h-[58px] mt-4 rounded-2 animate-pulse bg-gray-200" />}

      {!pending && !isRegistered && (
        <UnregisteredUser username={username!} onRegistered={refresh} />
      )}

      {!pending && isRegistered && (
        <>
          <UserCalendars username={username!} />
          <UserAddressBooks username={username!} />
          <UserBookingLinks username={username!} />
          <CalendarUserTasks username={username!} />
        </>
      )}
    </div>
  );
}
