import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { RegisteredUserNames } from "./validation";

// The DAV APIs do not expose the directory (LDAP) firstname/lastname, so the admin is asked for them.
export function RegisterUserForm({
  username,
  defaults,
  onChange,
}: {
  username: string;
  defaults: RegisteredUserNames;
  onChange: (data: RegisteredUserNames) => void;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();
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
        <label htmlFor={`${idPrefix}-firstname`} className="text-sm font-medium">{t("registeredUsers.firstname")} <span className="text-red-500">*</span></label>
        <input
          id={`${idPrefix}-firstname`}
          type="text"
          required
          value={firstname}
          onChange={(e) => { setFirstname(e.target.value); onChange({ firstname: e.target.value, lastname }); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-lastname`} className="text-sm font-medium">{t("registeredUsers.lastname")} <span className="text-red-500">*</span></label>
        <input
          id={`${idPrefix}-lastname`}
          type="text"
          required
          value={lastname}
          onChange={(e) => { setLastname(e.target.value); onChange({ firstname, lastname: e.target.value }); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
