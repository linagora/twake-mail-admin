// Labels separated by dots, each made of letters, digits and inner hyphens.
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;

export const isValidDomainName = (domain: string): boolean => DOMAIN_PATTERN.test(domain);
