// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  api: {
    getUserMappings: vi.fn(),
    getUserMappingSources: vi.fn(),
    deleteUserMappingSources: vi.fn(),
  },
}));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => mocks.api);

import UserMappings from "./user-mappings";

const EMMA = "emma@example.com";
const ALIAS = "emma.qa@example.com";

beforeAll(() => i18n.changeLanguage("en"));

beforeEach(() => {
  vi.resetAllMocks();
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
