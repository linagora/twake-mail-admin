// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));
const api = vi.hoisted(() => ({
  getDomainQuota: vi.fn(),
  updateDomainQuota: vi.fn(),
  deleteDomainQuotaSize: vi.fn(),
}));
const confirmation = vi.hoisted(() => ({ answer: true }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => confirmation.answer }));
vi.mock("../api-client", () => api);
vi.mock("@/components/custom/quota-usage-sum", () => ({ default: () => null }));
vi.mock("@/components/custom/explore-user-quota", () => ({ default: () => null }));

import DomainQuotaSection from "./domain-quota";

const ALL = [{ endpoint: "/quota/domains/*" }];
const WITH_DOMAIN_LIMIT = {
  computed: { count: null, size: 2147483648 },
  domain: { count: null, size: 2147483648 },
  global: { count: null, size: 1073741824 },
};
const WITHOUT_DOMAIN_LIMIT = { ...WITH_DOMAIN_LIMIT, domain: { count: null, size: null } };

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
  render(<DomainQuotaSection domain="linagora.com" defaultOpen />);
}

beforeEach(() => {
  api.getDomainQuota.mockReset();
  api.updateDomainQuota.mockReset();
  api.deleteDomainQuotaSize.mockReset();
  confirmation.answer = true;
});

afterEach(cleanup);

describe("domain quota reset", () => {
  it("removes the domain size limit once confirmed, then reloads", async () => {
    api.getDomainQuota.mockResolvedValue(WITH_DOMAIN_LIMIT);
    api.deleteDomainQuotaSize.mockResolvedValue(undefined);
    renderWith(ALL);

    fireEvent.click(await screen.findByText("common.resetToGlobalDefault"));

    await waitFor(() => expect(api.deleteDomainQuotaSize).toHaveBeenCalledWith("linagora.com"));
    await waitFor(() => expect(api.getDomainQuota).toHaveBeenCalledTimes(2));
  });

  it("does nothing when the confirmation is declined", async () => {
    confirmation.answer = false;
    api.getDomainQuota.mockResolvedValue(WITH_DOMAIN_LIMIT);
    renderWith(ALL);

    fireEvent.click(await screen.findByText("common.resetToGlobalDefault"));

    await waitFor(() => expect(api.getDomainQuota).toHaveBeenCalledTimes(1));
    expect(api.deleteDomainQuotaSize).not.toHaveBeenCalled();
  });

  it("is not offered when the domain has no size limit", async () => {
    api.getDomainQuota.mockResolvedValue(WITHOUT_DOMAIN_LIMIT);
    renderWith(ALL);

    expect(await screen.findByText("common.updateSizeLimit")).not.toBeNull();
    expect(screen.queryByText("common.resetToGlobalDefault")).toBeNull();
  });

  it("is not offered when the profile does not allow deleting the size limit", async () => {
    api.getDomainQuota.mockResolvedValue(WITH_DOMAIN_LIMIT);
    renderWith([{ endpoint: "/quota/domains/*", verb: ["GET", "PUT"] }]);

    expect(await screen.findByText("common.updateSizeLimit")).not.toBeNull();
    expect(screen.queryByText("common.resetToGlobalDefault")).toBeNull();
  });
});
