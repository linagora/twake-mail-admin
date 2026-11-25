const domainOfAddress = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();

const TEMPLATES_FOLDER = "Templates";

const TEMPLATES_SUB_FOLDER_PREFIX = `${TEMPLATES_FOLDER}.`;

/**
 * The provisioning copies a folder of the source user into the target users: WebAdmin refuses
 * (400) a source user who is not of the target's domain, whoever runs it.
 * Returns the translation key of the error, or null when the source user is acceptable.
 */
export const provisionSourceError = (sourceUser: string, domain: string): string | null => {
  if (!sourceUser) return "provisionTemplates.sourceUserRequired";
  if (domainOfAddress(sourceUser) !== domain.toLowerCase()) return "provisionTemplates.sourceUserOtherDomain";
  return null;
};

/**
 * The error to show on the source user field as it is typed: a missing source is only reported
 * on Run, and a domain only once its "@" is typed, so that the field is not flagged mid-word.
 */
export const provisionSourceInlineError = (sourceUser: string, domain: string): string | null => {
  const trimmed = sourceUser.trim();
  return trimmed.includes("@") ? provisionSourceError(trimmed, domain) : null;
};

const isTemplatesFolder = (folderName: string) =>
  folderName === TEMPLATES_FOLDER
  || (folderName.startsWith(TEMPLATES_SUB_FOLDER_PREFIX) && folderName.length > TEMPLATES_SUB_FOLDER_PREFIX.length);

/**
 * WebAdmin only copies (and prunes) "Templates" or one of its sub-folders, e.g. "Templates.Marketing",
 * never another mailbox such as INBOX. An empty name is sent as no name: the server defaults it to "Templates".
 * Returns the translation key of the error, or null when the folder name is acceptable.
 */
export const provisionFolderError = (folderName: string): string | null => {
  const trimmed = folderName.trim();
  return !trimmed || isTemplatesFolder(trimmed) ? null : "provisionTemplates.folderNotTemplates";
};

/** The first error of the provisioning values, as a translation key taking `{{domain}}`; null when they can be sent. */
export const provisionValuesError = (sourceUser: string, folderName: string, domain: string): string | null =>
  provisionSourceError(sourceUser.trim(), domain) ?? provisionFolderError(folderName);
