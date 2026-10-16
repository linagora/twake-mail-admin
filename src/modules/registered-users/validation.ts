type Translate = (key: string) => string;

export interface RegisteredUserNames {
  firstname: string;
  lastname: string;
}

export interface RegisteredUserFields extends RegisteredUserNames {
  email: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(email.trim());

// The directory names are unknown: the local part of the address is suggested as firstname.
export const defaultRegisteredUserNames = (username: string): RegisteredUserNames => ({
  firstname: username.split("@")[0] || "",
  lastname: "",
});

// The DAV server refuses a registered user without a firstname or a lastname.
export const validateRegisteredUserNames = ({ firstname, lastname }: RegisteredUserNames, t: Translate): string | null => {
  if (!firstname.trim()) return t("registeredUsers.firstnameRequired");
  if (!lastname.trim()) return t("registeredUsers.lastnameRequired");
  return null;
};

export const validateRegisteredUser = (fields: RegisteredUserFields, t: Translate): string | null =>
  isValidEmail(fields.email) ? validateRegisteredUserNames(fields, t) : t("registeredUsers.invalidEmail");
