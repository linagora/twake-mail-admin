// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";

const api = vi.hoisted(() => ({
  getMappings: vi.fn(async () => ({ "alice.alias@example.com": [{ type: "Alias", mapping: "alice@example.com" }] })),
  createAddressMapping: vi.fn(),
  createDomainMapping: vi.fn(),
  createRegexMapping: vi.fn(),
  deleteAddressMapping: vi.fn(),
  deleteAliasMapping: vi.fn(),
  deleteForwardMapping: vi.fn(),
  deleteGroupMapping: vi.fn(),
  deleteDomainMapping: vi.fn(),
  deleteRegexMapping: vi.fn(),
}));
vi.mock("./api-client", () => api);
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
const confirmFn = vi.hoisted(() => vi.fn<(options: Record<string, unknown>) => Promise<boolean>>(async () => false));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => confirmFn }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import MappingsList from "./mappings-list";

beforeAll(() => i18n.changeLanguage("fr"));
afterAll(() => i18n.changeLanguage("en"));
afterEach(cleanup);

describe("mappings list: removal wording in French", () => {
  it("uses the same verb in the title and on the button, the type in lower case", async () => {
    render(<MemoryRouter><MappingsList /></MemoryRouter>);
    const button = await screen.findByRole("button", {
      name: "Retirer la réécriture d'adresse alias de « alice.alias@example.com » vers « alice@example.com »",
    });

    fireEvent.click(button);

    await vi.waitFor(() => expect(confirmFn).toHaveBeenCalled());
    const options = confirmFn.mock.calls[0][0];
    expect(options.header).toBe("Retirer la réécriture d'adresse alias");
    expect(options.confirmLabel).toBe("Retirer");
  });
});
