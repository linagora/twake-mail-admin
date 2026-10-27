// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ConfirmOptions } from "@/components/custom/confirm-provider";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  allowed: vi.fn(),
  api: {
    getTeamMailboxSpace: vi.fn(),
    bindTeamMailboxSpace: vi.fn(),
    requestSpacesSync: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: mocks.allowed }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/modules/twake-space/api-client", () => mocks.api);

import TeamMailboxSpace from "./team-mailbox-space";

const SPACE = "11111111-1111-1111-1111-111111111111";
const LIVE = { organizationId: "org-1", spaceId: SPACE, deletedAt: null };
const DELETED = { ...LIVE, deletedAt: "2026-10-09T08:00:00Z" };

const refusal = (status: number, message = "Request failed") =>
  new AxiosError(message, undefined, undefined, undefined, {
    status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { message },
  });

const dialog = () => screen.getByRole("dialog");
const field = (label: string) => within(dialog()).getByLabelText(label) as HTMLInputElement;
const submit = (name: string) => within(dialog()).getByRole("button", { name }) as HTMLButtonElement;

const renderSection = (onBound = vi.fn()) => {
  render(<TeamMailboxSpace domain="domain.tld" mailbox="sales" onBound={onBound} />);
  return onBound;
};

const openBindDialog = async (label = "twakeSpace.bind.title") => {
  fireEvent.click(await screen.findByRole("button", { name: label }));
  return dialog();
};

const typeBinding = (organizationId: string, spaceId: string) => {
  fireEvent.change(field("twakeSpace.organizationId"), { target: { value: organizationId } });
  fireEvent.change(field("twakeSpace.spaceId"), { target: { value: spaceId } });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.allowed.mockReturnValue(true);
  mocks.api.bindTeamMailboxSpace.mockResolvedValue(undefined);
  mocks.api.requestSpacesSync.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("team mailbox Twake space: reading", () => {
  it("shows the organization and the space of a bound team mailbox (200)", async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(LIVE);
    renderSection();

    expect(await screen.findByText("org-1")).not.toBeNull();
    expect(screen.getByText(SPACE)).not.toBeNull();
    expect(screen.queryByText(/twakeSpace.deletedOn/)).toBeNull();
    // A live space cannot be bound elsewhere: the server would answer 409
    expect(screen.queryByRole("button", { name: "twakeSpace.bind.title" })).toBeNull();
  });

  it("warns that the space was deleted and offers to reopen it", async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(DELETED);
    renderSection();

    expect(await screen.findByText(/twakeSpace.deletedOn/)).not.toBeNull();
    await openBindDialog("twakeSpace.bind.reopen");
    expect(field("twakeSpace.organizationId").value).toBe("org-1");
    expect(field("twakeSpace.spaceId").value).toBe(SPACE);
  });

  it("shows an unbound team mailbox, never an error, when the space is not found (404)", async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(null);
    renderSection();

    expect(await screen.findByText("twakeSpace.notBound")).not.toBeNull();
    expect(screen.queryByText(/common.errorPrefix/)).toBeNull();
    expect(screen.queryByRole("button", { name: /twakeSpace.sync.thisSpace/ })).toBeNull();
  });

  it("is hidden when reading the space is not allowed", () => {
    mocks.allowed.mockReturnValue(false);
    renderSection();

    expect(screen.queryByText("twakeSpace.title")).toBeNull();
    expect(mocks.api.getTeamMailboxSpace).not.toHaveBeenCalled();
  });
});

describe("team mailbox Twake space: binding", () => {
  beforeEach(() => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(null);
  });

  it("binds the team mailbox, then refreshes the section and the members (204)", async () => {
    const onBound = renderSection();
    await openBindDialog();
    typeBinding("org-1", SPACE);
    mocks.api.getTeamMailboxSpace.mockResolvedValue(LIVE);
    fireEvent.click(submit("twakeSpace.bind.title"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.api.bindTeamMailboxSpace).toHaveBeenCalledWith("domain.tld", "sales", { organizationId: "org-1", spaceId: SPACE });
    expect(mocks.toast).toHaveBeenCalledWith({ title: "twakeSpace.bind.success" });
    expect(onBound).toHaveBeenCalled();
    expect(await screen.findByText("org-1")).not.toBeNull();
  });

  it("previews the request it sends", async () => {
    renderSection();
    await openBindDialog();
    typeBinding("org-1", SPACE);

    expect(within(dialog()).getByText(/curl -XPUT \/domains\/domain.tld\/team-mailboxes\/sales\/space/)).not.toBeNull();
  });

  it("checks the space ID format in place", async () => {
    renderSection();
    await openBindDialog();
    typeBinding("org-1", "not-a-uuid");

    expect(within(dialog()).getByText("twakeSpace.invalidSpaceId")).not.toBeNull();
    expect(submit("twakeSpace.bind.title").disabled).toBe(true);
  });

  it("keeps the dialog open and says the mailbox belongs to another space (409)", async () => {
    mocks.api.bindTeamMailboxSpace.mockRejectedValue(refusal(409, "Conflict"));
    renderSection();
    await openBindDialog();
    typeBinding("org-1", SPACE);
    fireEvent.click(submit("twakeSpace.bind.title"));

    expect(await within(dialog()).findByText("twakeSpace.bind.conflict")).not.toBeNull();
    expect(field("twakeSpace.spaceId").value).toBe(SPACE);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("shows the server message of a refused body in place (400)", async () => {
    mocks.api.bindTeamMailboxSpace.mockRejectedValue(refusal(400, "Invalid organizationId"));
    renderSection();
    await openBindDialog();
    typeBinding("org-1", SPACE);
    fireEvent.click(submit("twakeSpace.bind.title"));

    expect(await within(dialog()).findByText(/Invalid organizationId/)).not.toBeNull();
  });

  it("hides the bind button when binding is not allowed", async () => {
    mocks.allowed.mockImplementation((verb: string) => verb === "GET");
    renderSection();

    expect(await screen.findByText("twakeSpace.notBound")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "twakeSpace.bind.title" })).toBeNull();
  });
});

describe("team mailbox Twake space: sync this space", () => {
  const requestSync = async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(LIVE);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /twakeSpace.sync.thisSpace/ }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    return mocks.confirm.mock.calls[0][0] as ConfirmOptions;
  };

  it("requests a sync of the space, prefilled with its IDs (204)", async () => {
    const options = await requestSync();

    expect(options.validate?.()).toBeNull();
    await options.action?.();
    expect(mocks.api.requestSpacesSync).toHaveBeenCalledWith({ organizationId: "org-1", spaceId: SPACE });
    expect(mocks.toast).toHaveBeenCalledWith({ title: "twakeSpace.sync.requested" });
  });

  it("explains that the feature is unavailable rather than showing a raw 404", async () => {
    mocks.api.requestSpacesSync.mockRejectedValue(refusal(404));
    const options = await requestSync();

    await expect(options.action?.()).rejects.toThrow("twakeSpace.unavailable");
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
