// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({
  getGlobalQuota: vi.fn(),
  updateGlobalQuota: vi.fn(),
  deleteGlobalQuotaSize: vi.fn(),
  getUsersWithSpecificQuotas: vi.fn(),
  getQuotaExtraSummary: vi.fn(),
}));
const confirmation = vi.hoisted(() => ({ answer: true }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => confirmation.answer }));
vi.mock("./api-client", () => api);
vi.mock("@/components/custom/header", () => ({ default: () => null }));
vi.mock("@/components/custom/quota-usage-sum", () => ({ default: () => null }));
vi.mock("@/components/custom/explore-user-quota", () => ({ default: () => null }));
vi.mock("./users-with-specific-quotas", () => ({ default: () => null }));

import GlobalQuota from "./index";

const ALL = [{ endpoint: "/quota" }, { endpoint: "/quota/size" }];

function renderWith(rules: ProxyRule[], size: number | null) {
  proxy.resolver = new ProxyResolver(rules);
  api.getGlobalQuota.mockResolvedValue({ count: null, size });
  render(<GlobalQuota />);
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getUsersWithSpecificQuotas.mockResolvedValue([]);
  api.getQuotaExtraSummary.mockResolvedValue({
    totalExtraStorageLimit: 0,
    totalExtraCountLimit: 0,
    totalUnlimitedStorage: 0,
    totalUnlimitedCount: 0,
  });
  confirmation.answer = true;
});

afterEach(cleanup);

describe("global quota size removal", () => {
  it("removes the global size limit once confirmed, then reloads", async () => {
    api.deleteGlobalQuotaSize.mockResolvedValue(undefined);
    renderWith(ALL, 1073741824);

    fireEvent.click(await screen.findByText("globalQuota.removeSizeLimit"));

    await waitFor(() => expect(api.deleteGlobalQuotaSize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getGlobalQuota).toHaveBeenCalledTimes(2));
  });

  it("does nothing when the confirmation is declined", async () => {
    confirmation.answer = false;
    renderWith(ALL, 1073741824);

    fireEvent.click(await screen.findByText("globalQuota.removeSizeLimit"));

    await waitFor(() => expect(api.getGlobalQuota).toHaveBeenCalledTimes(1));
    expect(api.deleteGlobalQuotaSize).not.toHaveBeenCalled();
  });

  it("is not offered when no global size limit is set", async () => {
    renderWith(ALL, null);

    expect(await screen.findByText("common.updateSizeLimit")).not.toBeNull();
    expect(screen.queryByText("globalQuota.removeSizeLimit")).toBeNull();
  });

  it("is not offered when the profile does not allow deleting the size limit", async () => {
    renderWith([{ endpoint: "/quota" }], 1073741824);

    expect(await screen.findByText("common.updateSizeLimit")).not.toBeNull();
    expect(screen.queryByText("globalQuota.removeSizeLimit")).toBeNull();
  });
});
