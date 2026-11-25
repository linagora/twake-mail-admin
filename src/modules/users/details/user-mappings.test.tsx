// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  isAllowed: vi.fn(),
  api: {
    getUserMappings: vi.fn(),
    getUserMappingSources: vi.fn(),
    deleteUserMappingSources: vi.fn(),
  },
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: mocks.isAllowed }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => mocks.api);

import UserMappings from "./user-mappings";

const EMMA = "emma@example.com";
const ALIAS = "emma.qa@example.com";

beforeAll(() => i18n.changeLanguage("en"));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAllowed.mockReturnValue(true);
  mocks.confirm.mockResolvedValue(true);
  mocks.api.getUserMappings.mockResolvedValue([]);
  mocks.api.getUserMappingSources.mockImplementation(async (_user: string, type: string) =>
    type === "alias" ? [ALIAS] : []
  );
  mocks.api.deleteUserMappingSources.mockResolvedValue(undefined);
});

afterEach(cleanup);

const openSourcesOfAlias = async () => {
  render(<UserMappings username={EMMA} />);
  fireEvent.click(await screen.findByRole("button", { name: /Mappings/ }));
  await screen.findByText(ALIAS);
};

describe("user mappings: sources pointing to the user", () => {
  it("labels the source type with its translated name", async () => {
    await openSourcesOfAlias();

    expect(screen.getByText("Alias")).toBeTruthy();
    expect(screen.getByTitle("Remove all Alias sources")).toBeTruthy();
  });

  it("names the translated source type in the confirmation and the success toast", async () => {
    await openSourcesOfAlias();

    fireEvent.click(screen.getByTitle("Remove all Alias sources"));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({ title: `Alias sources of ${EMMA} removed` })
    );
    expect(mocks.confirm).toHaveBeenCalledWith({
      header: "Remove all Alias sources",
      destructive: true,
      confirmLabel: "Remove",
      message: `Remove all Alias sources of ${EMMA} (${ALIAS})?`,
    });
    expect(mocks.api.deleteUserMappingSources).toHaveBeenCalledWith(EMMA, "alias");
  });

  it("names the translated source type in the error toast", async () => {
    mocks.api.deleteUserMappingSources.mockRejectedValue(new Error("boom"));
    await openSourcesOfAlias();

    fireEvent.click(screen.getByTitle("Remove all Alias sources"));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: `Error removing the Alias sources of ${EMMA}` })
      )
    );
  });
});

describe("user mappings: a profile without the reverse lookup", () => {
  const OWN_DESTINATION = "emma.forward@example.com";

  beforeEach(() => {
    mocks.isAllowed.mockImplementation(
      (_verb: string, pattern: string) => !pattern.startsWith("/mappings/sources/")
    );
    mocks.api.getUserMappings.mockResolvedValue([{ type: "Forward", mapping: OWN_DESTINATION }]);
  });

  it("shows the user's own mappings but never asks for the sources pointing at the user", async () => {
    render(<UserMappings username={EMMA} />);
    fireEvent.click(await screen.findByRole("button", { name: /Mappings/ }));

    await screen.findByText(OWN_DESTINATION);
    expect(mocks.api.getUserMappingSources).not.toHaveBeenCalled();
    expect(screen.queryByText(ALIAS)).toBeNull();
    expect(screen.queryByTitle("Remove all Alias sources")).toBeNull();
  });
});

describe("user mappings: a long address fits a phone screen", () => {
  const LONG_SOURCE = "another.very.long.qa.alias.without.any.break@example.com";
  const LONG_DESTINATION = "a.very.long.qa.destination.without.any.break@example.com";

  const openMappings = async () => {
    render(<UserMappings username={EMMA} />);
    fireEvent.click(await screen.findByRole("button", { name: /Mappings/ }));
  };

  it("lets a source row break inside the address", async () => {
    mocks.api.getUserMappingSources.mockImplementation(async (_user: string, type: string) =>
      type === "alias" ? [LONG_SOURCE] : []
    );
    await openMappings();

    const source = await screen.findByText(LONG_SOURCE);
    expect(source.className).toContain("min-w-0");
    expect(source.className).toContain("[overflow-wrap:anywhere]");
  });

  it("lets a destination cell break inside the address", async () => {
    mocks.api.getUserMappings.mockResolvedValue([{ type: "Forward", mapping: LONG_DESTINATION }]);
    await openMappings();

    const destination = await screen.findByText(LONG_DESTINATION);
    expect(destination.className).toContain("[overflow-wrap:anywhere]");
  });
});
