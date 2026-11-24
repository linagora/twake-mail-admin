import { getTeamMailboxes } from "@/modules/domains/api-client";
import { TeamMailbox } from "@/modules/domains/types";

/** A team mailbox, by the address WebAdmin lists in a quota report. */
export type TeamMailboxesByAddress = ReadonlyMap<string, TeamMailbox & { domain: string }>;

export const NO_TEAM_MAILBOXES: TeamMailboxesByAddress = new Map();

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();

const distinctDomains = (addresses: string[]): string[] =>
  [...new Set(addresses.filter((address) => address.includes("@")).map(domainOf))];

// A domain whose team mailboxes cannot be read keeps its addresses linked as users
const teamMailboxesOf = (domain: string) =>
  getTeamMailboxes(domain)
    .then((mailboxes) => mailboxes.map((mailbox) => ({ ...mailbox, domain })))
    .catch(() => []);

/**
 * The team mailboxes among the addresses of a quota report: WebAdmin lists their quota roots
 * next to the users', and only the team mailboxes of their domains tell them apart.
 */
export const findTeamMailboxes = async (addresses: string[]): Promise<TeamMailboxesByAddress> => {
  const perDomain = await Promise.all(distinctDomains(addresses).map(teamMailboxesOf));
  return new Map(perDomain.flat().map((mailbox) => [mailbox.emailAddress.toLowerCase(), mailbox]));
};

export const teamMailboxPath = ({ domain, name }: { domain: string; name: string }) =>
  `/domains/domain/${encodeURIComponent(domain)}/team-mailbox/${encodeURIComponent(name)}`;
