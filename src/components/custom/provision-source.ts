const domainOfAddress = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();

/**
 * The provisioning copies a folder of the source user, whoever they are. A domain administrator
 * (`domainScoped`) only provisions from a user of the administered domain. The profile enforces it too.
 * Returns the translation key of the error, or null when the source user is acceptable.
 */
export const provisionSourceError = (sourceUser: string, domain: string, domainScoped: boolean): string | null => {
  if (!sourceUser) return "provisionTemplates.sourceUserRequired";
  if (domainScoped && domainOfAddress(sourceUser) !== domain.toLowerCase()) return "provisionTemplates.sourceUserOtherDomain";
  return null;
};
