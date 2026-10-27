// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ConfirmOptions } from "@/components/custom/confirm-provider";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toast: vi.fn(),
  onBound: vi.fn(),
  api: {
    getTeamMailboxSpace: vi.fn(),
    bindTeamMailboxSpace: vi.fn(),
    TWAKE_SPACE_UNAVAILABLE: "unavailable",
  },
  spaces: {
    requestSpacesSync: vi.fn(),
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
vi.mock("@/modules/twake-space/api-client", () => mocks.spaces);

import TeamMailboxSpace from "./team-mailbox-space";

const SPACE_ID = "11111111-1111-1111-1111-111111111111";

// What Axios rejects with when WebAdmin answers an error status
const webAdminError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message } },
  });

const dialog = () => screen.getByRole("dialog");
const field = (label: string) => within(dialog()).getByLabelText(label) as HTMLInputElement;
const submitButton = (name: string) => within(dialog()).getByRole("button", { name });

const renderSection = () =>
  render(<TeamMailboxSpace domain="example.com" mailbox="sales" onBound={mocks.onBound} />);

const openBindDialog = async (label = "domains.teamMailboxSpace.bind") => {
  renderSection();
  fireEvent.click(await screen.findByRole("button", { name: label }));
};

const fillIdentifiers = (organizationId: string, spaceId: string) => {
  fireEvent.change(field("domains.teamMailboxSpace.organizationId"), { target: { value: organizationId } });
  fireEvent.change(field("domains.teamMailboxSpace.spaceId"), { target: { value: spaceId } });
};

const markDeletedAt = (localTime: string) => {
  fireEvent.click(within(dialog()).getByLabelText("domains.teamMailboxSpace.deletedSpace"));
  fireEvent.change(field("domains.teamMailboxSpace.deletedAt"), { target: { value: localTime } });
};

const submit = () => fireEvent.click(submitButton("domains.teamMailboxSpace.bind"));

const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Paris";
});
afterAll(() => {
  process.env.TZ = originalTz;
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getTeamMailboxSpace.mockResolvedValue(null);
  mocks.api.bindTeamMailboxSpace.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("team mailbox Twake Space: the space shown", () => {
  it("hides the section on a server without the Twake Space extension", async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue("unavailable");
    const { container } = renderSection();

    await waitFor(() => expect(mocks.api.getTeamMailboxSpace).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(""));
    expect(screen.queryByRole("button", { name: "domains.teamMailboxSpace.bind" })).toBeNull();
  });

  it("reads the 404 of a team mailbox bound to no space as not bound rather than as an error", async () => {
    renderSection();

    expect(await screen.findByText("domains.teamMailboxSpace.notBound")).not.toBeNull();
    expect(screen.queryByText(/common.errorPrefix/)).toBeNull();
  });

  it("shows the identifiers of the space, and offers to reopen a deleted one prefilled", async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue({ organizationId: "org-1", spaceId: SPACE_ID, deletedAt: "2026-10-09T08:00:00Z" });
    await openBindDialog("domains.teamMailboxSpace.reopen");

    expect(screen.getByText(/domains.teamMailboxSpace.deletedOn/)).not.toBeNull();
    expect(field("domains.teamMailboxSpace.organizationId").value).toBe("org-1");
    expect(field("domains.teamMailboxSpace.spaceId").value).toBe(SPACE_ID);
  });
});

describe("team mailbox Twake Space: bind", () => {
  it("binds to an active space without deletedAt, then refreshes the space and the members", async () => {
    await openBindDialog();
    fillIdentifiers("org-1", SPACE_ID);
    submit();

    await waitFor(() =>
      expect(mocks.api.bindTeamMailboxSpace).toHaveBeenCalledWith("example.com", "sales", { organizationId: "org-1", spaceId: SPACE_ID })
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith({ title: "domains.teamMailboxSpace.bound" });
    expect(mocks.onBound).toHaveBeenCalled();
    expect(mocks.api.getTeamMailboxSpace).toHaveBeenCalledTimes(2);
  });

  it("binds to a deleted space with its deletedAt in UTC, once the removal of the members is confirmed", async () => {
    mocks.confirm.mockResolvedValue(true);
    await openBindDialog();
    fillIdentifiers("org-1", SPACE_ID);
    markDeletedAt("2026-10-01T10:00");

    expect(within(dialog()).getByText(/"deletedAt":"2026-10-01T08:00:00Z"/).textContent)
      .toContain(`-H "Content-Type: application/json"`);
    submit();

    await waitFor(() =>
      expect(mocks.api.bindTeamMailboxSpace).toHaveBeenCalledWith("example.com", "sales", {
        organizationId: "org-1",
        spaceId: SPACE_ID,
        deletedAt: "2026-10-01T08:00:00Z",
      })
    );
    const confirmation = mocks.confirm.mock.calls[0][0];
    expect(confirmation.destructive).toBe(true);
    expect(confirmation.message).toContain("sales@example.com");
    expect(mocks.onBound).toHaveBeenCalled();
  });

  it("does not bind to a deleted space when the confirmation is declined", async () => {
    mocks.confirm.mockResolvedValue(false);
    await openBindDialog();
    fillIdentifiers("org-1", SPACE_ID);
    markDeletedAt("2026-10-01T10:00");
    submit();

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.api.bindTeamMailboxSpace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  it("refuses a space ID that is not a UUID in the dialog", async () => {
    await openBindDialog();
    fillIdentifiers("org-1", "space-1");
    submit();

    expect((await within(dialog()).findAllByText("domains.teamMailboxSpace.invalidSpaceId")).length).toBeGreaterThan(0);
    expect(mocks.api.bindTeamMailboxSpace).not.toHaveBeenCalled();
  });

  it("requires the deletion date of a deleted space", async () => {
    await openBindDialog();
    fillIdentifiers("org-1", SPACE_ID);
    fireEvent.click(within(dialog()).getByLabelText("domains.teamMailboxSpace.deletedSpace"));
    submit();

    expect(await within(dialog()).findByText("domains.teamMailboxSpace.deletedAtRequired")).not.toBeNull();
    expect(mocks.api.bindTeamMailboxSpace).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on a 409 and explains both conflicts with the WebAdmin message", async () => {
    mocks.api.bindTeamMailboxSpace.mockRejectedValue(webAdminError(409, "Space is already bound to team mailbox support@example.com"));
    await openBindDialog();
    fillIdentifiers("org-1", SPACE_ID);
    submit();

    expect(await within(dialog()).findByText("domains.teamMailboxSpace.conflict")).not.toBeNull();
    expect(within(dialog()).getByText("Space is already bound to team mailbox support@example.com")).not.toBeNull();
    expect(field("domains.teamMailboxSpace.spaceId").value).toBe(SPACE_ID);
    expect(mocks.onBound).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on a 400 with the WebAdmin message, without the conflict explanation", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.api.bindTeamMailboxSpace.mockRejectedValue(webAdminError(400, "Invalid deletedAt"));
    await openBindDialog();
    fillIdentifiers("org-1", SPACE_ID);
    markDeletedAt("2026-10-01T10:00");
    submit();

    expect(await within(dialog()).findByText("Invalid deletedAt")).not.toBeNull();
    expect(within(dialog()).queryByText("domains.teamMailboxSpace.conflict")).toBeNull();
  });
});

describe("team mailbox Twake space: sync this space", () => {
  const LIVE = { organizationId: "org-1", spaceId: SPACE_ID, deletedAt: null };

  const requestSync = async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(LIVE);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /twakeSpace.sync.thisSpace/ }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    return mocks.confirm.mock.calls[0][0] as ConfirmOptions;
  };

  it("requests a sync of the space, prefilled with its IDs (204)", async () => {
    mocks.spaces.requestSpacesSync.mockResolvedValue(undefined);
    const options = await requestSync();

    expect(options.validate?.()).toBeNull();
    await options.action?.();
    expect(mocks.spaces.requestSpacesSync).toHaveBeenCalledWith({ organizationId: "org-1", spaceId: SPACE_ID });
    expect(mocks.toast).toHaveBeenCalledWith({ title: "twakeSpace.sync.requested" });
  });

  it("explains that the feature is unavailable rather than showing a raw 404", async () => {
    mocks.spaces.requestSpacesSync.mockRejectedValue(
      new AxiosError("Not found", undefined, undefined, undefined, {
        status: 404, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: {},
      }),
    );
    const options = await requestSync();

    await expect(options.action?.()).rejects.toThrow("twakeSpace.unavailable");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("is not offered for a team mailbox bound to no space", async () => {
    mocks.api.getTeamMailboxSpace.mockResolvedValue(null);
    renderSection();

    await screen.findByText("domains.teamMailboxSpace.notBound");
    expect(screen.queryByRole("button", { name: /twakeSpace.sync.thisSpace/ })).toBeNull();
  });
});
