// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  api: {
    getUserMappings: vi.fn(),
    getUserMappingSources: vi.fn(),
    deleteUserMappingSources: vi.fn(),
    getUserChannels: vi.fn(),
    disconnectUserChannels: vi.fn(),
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
vi.mock("@/modules/network-channels/components/channel-grid", () => ({ default: () => null }));
vi.mock("../api-client", () => mocks.api);

import UserMappings from "./user-mappings";
import UserChannels from "./user-channels";

const ALICE = "alice@example.com";
const BOB = "bob@example.com";

const toastTitle = () => mocks.toast.mock.calls[0][0].title;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.api.getUserMappings.mockResolvedValue([]);
  mocks.api.getUserMappingSources.mockImplementation(async (_user: string, type: string) =>
    type === "alias" ? ["alice.alias@example.com", "a@example.com"] : []
  );
  mocks.api.getUserChannels.mockResolvedValue([]);
});

afterEach(cleanup);

describe("user mappings: remove all sources", () => {
  const removeAliasSources = async () => {
    render(<UserMappings username={ALICE} />);
    fireEvent.click(screen.getByText("users.mappings.title"));
    fireEvent.click(await screen.findByTitle(/users\.mappings\.removeAllSources/));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  };

  it("names the user and the sources in the confirmation", async () => {
    await removeAliasSources();
    expect(mocks.confirm.mock.calls[0][0].message).toBe(
      `users.mappings.removeAllSourcesConfirm ${JSON.stringify({
        type: "alias",
        username: ALICE,
        sources: "alice.alias@example.com, a@example.com",
      })}`
    );
  });

  it("reports the result on success", async () => {
    mocks.api.deleteUserMappingSources.mockResolvedValue(undefined);
    await removeAliasSources();
    expect(toastTitle()).toBe(`users.mappings.sourcesRemoved ${JSON.stringify({ type: "alias", username: ALICE })}`);
  });

  it("uses a distinct title on failure", async () => {
    mocks.api.deleteUserMappingSources.mockRejectedValue(new Error("boom"));
    await removeAliasSources();
    expect(toastTitle()).toBe(`users.mappings.errorRemovingSources ${JSON.stringify({ type: "alias", username: ALICE })}`);
  });
});

describe("user channels: disconnect all", () => {
  const disconnectAll = async () => {
    render(<UserChannels username={BOB} />);
    fireEvent.click(screen.getByText("users.channels.title"));
    fireEvent.click(screen.getByText("users.channels.disconnectAll"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  };

  it("reports the disconnected user on success", async () => {
    mocks.api.disconnectUserChannels.mockResolvedValue(undefined);
    await disconnectAll();
    expect(toastTitle()).toBe(`users.channels.disconnected ${JSON.stringify({ username: BOB })}`);
  });

  it("uses a distinct title on failure", async () => {
    mocks.api.disconnectUserChannels.mockRejectedValue(new Error("boom"));
    await disconnectAll();
    expect(toastTitle()).toBe(`users.channels.errorDisconnecting ${JSON.stringify({ username: BOB })}`);
  });
});
