// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  api: {
    getUserAliases: vi.fn(),
    addUserAlias: vi.fn(),
    removeUserAlias: vi.fn(),
    getUserMappings: vi.fn(),
    getUserMappingSources: vi.fn(),
    deleteUserMappingSources: vi.fn(),
    getAllowedFromHeaders: vi.fn(),
    getUserTeamMailboxes: vi.fn(),
    getUserIdentities: vi.fn(),
  },
  domainsApi: {
    removeTeamMailboxMember: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => mocks.api);
vi.mock("@/modules/domains/api-client", () => mocks.domainsApi);

import UserAliases from "./user-aliases";
import UserMappings from "./user-mappings";
import UserAllowedFrom from "./user-allowed-from";
import UserTeamMailboxes from "./user-team-mailboxes";
import UserIdentities from "./user-identities";
import { UserMappingsRevisionContext, useUserMappingsRevisionState } from "./user-mappings-revision";

const ALICE = "alice@example.com";
const ALIAS = "alice.alias@example.com";
const SALES = { name: "sales", emailAddress: "sales@example.com" };

function UserDetailSections({ children }: { children: ReactNode }) {
  const mappingsRevision = useUserMappingsRevisionState();
  return (
    <UserMappingsRevisionContext.Provider value={mappingsRevision}>{children}</UserMappingsRevisionContext.Provider>
  );
}

const renderSections = () =>
  render(
    <UserDetailSections>
      <UserAliases username={ALICE} />
      <UserMappings username={ALICE} />
      <UserAllowedFrom username={ALICE} />
      <UserTeamMailboxes username={ALICE} />
      <UserIdentities username={ALICE} />
    </UserDetailSections>
  );

let aliases: string[];
let teamMailboxes: { name: string; emailAddress: string }[];

beforeEach(() => {
  vi.resetAllMocks();
  aliases = [ALIAS];
  teamMailboxes = [];
  mocks.confirm.mockResolvedValue(true);
  mocks.api.getUserAliases.mockImplementation(async () => aliases.map((source) => ({ source })));
  mocks.api.getUserMappings.mockResolvedValue([]);
  mocks.api.getUserMappingSources.mockImplementation(async (_user: string, type: string) =>
    type === "alias" ? [...aliases] : []
  );
  mocks.api.getAllowedFromHeaders.mockImplementation(async () => [
    ALICE,
    ...aliases,
    ...teamMailboxes.map((mailbox) => mailbox.emailAddress),
  ]);
  mocks.api.getUserTeamMailboxes.mockImplementation(async () => [...teamMailboxes]);
  mocks.api.getUserIdentities.mockImplementation(async () =>
    [ALICE, ...teamMailboxes.map((mailbox) => mailbox.emailAddress)].map((email) => ({ id: email, name: email, email }))
  );
  mocks.domainsApi.removeTeamMailboxMember.mockImplementation(async (_domain: string, mailbox: string) => {
    teamMailboxes = teamMailboxes.filter((teamMailbox) => teamMailbox.name !== mailbox);
  });
  mocks.api.addUserAlias.mockImplementation(async (_user: string, alias: string) => {
    aliases = [...aliases, alias];
  });
  mocks.api.deleteUserMappingSources.mockImplementation(async () => {
    aliases = [];
  });
});

afterEach(cleanup);

const sectionCount = (titleKey: string) => screen.getByText(titleKey).querySelector("span")?.textContent;

describe("user detail: mapping changes refresh every related section", () => {
  it("refreshes aliases and allowed from headers after removing alias sources from the mappings section", async () => {
    renderSections();
    await waitFor(() => expect(sectionCount("users.aliases.title")).toBe("(1)"));
    fireEvent.click(screen.getByText("users.mappings.title"));
    fireEvent.click(await screen.findByTitle(/users\.mappings\.removeAllSources/));

    await waitFor(() => expect(sectionCount("users.aliases.title")).toBe("(0)"));
    await waitFor(() => expect(sectionCount("users.allowedFrom.title")).toBe("(1)"));
  });

  it("refreshes mappings and allowed from headers after adding an alias from the aliases section", async () => {
    renderSections();
    await waitFor(() => expect(sectionCount("users.mappings.title")).toBe("(1)"));
    fireEvent.click(screen.getByText("users.aliases.title"));
    fireEvent.click(screen.getByTitle("users.aliases.addTooltip"));
    fireEvent.change(screen.getByPlaceholderText("users.aliases.placeholder"), {
      target: { value: "alice.qa@example.com" },
    });
    fireEvent.click(screen.getByText("common.add"));

    await waitFor(() => expect(sectionCount("users.mappings.title")).toBe("(2)"));
    await waitFor(() => expect(sectionCount("users.allowedFrom.title")).toBe("(3)"));
    expect(sectionCount("users.aliases.title")).toBe("(2)");
  });

  it("refreshes allowed from headers and identities after leaving a team mailbox", async () => {
    teamMailboxes = [SALES];
    renderSections();
    await waitFor(() => expect(sectionCount("users.allowedFrom.title")).toBe("(3)"));
    await waitFor(() => expect(sectionCount("users.identities.title")).toBe("(2)"));
    fireEvent.click(screen.getByText("users.teamMailboxes.title"));
    fireEvent.click(await screen.findByTitle("users.teamMailboxes.leaveTooltip"));

    await waitFor(() => expect(sectionCount("users.teamMailboxes.title")).toBe("(0)"));
    await waitFor(() => expect(sectionCount("users.allowedFrom.title")).toBe("(2)"));
    await waitFor(() => expect(sectionCount("users.identities.title")).toBe("(1)"));
    expect(mocks.domainsApi.removeTeamMailboxMember).toHaveBeenCalledWith("example.com", "sales", ALICE);
  });
});
