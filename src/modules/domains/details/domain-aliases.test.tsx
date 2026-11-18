// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  api: {
    getDomainAliases: vi.fn(),
    addDomainAlias: vi.fn(),
    removeDomainAlias: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../api-client", () => mocks.api);

import DomainAliases from "./domain-aliases";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.getDomainAliases.mockResolvedValue([{ source: "old.example.com" }]);
  mocks.api.addDomainAlias.mockResolvedValue(undefined);
});

afterEach(cleanup);

const openAddModal = () => {
  render(<DomainAliases domain="example.com" />);
  fireEvent.click(screen.getByTitle("domains.aliases.addTooltip"));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("domains.domainName"), { target: { value: " new.example.com " } });
  fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));
  return dialog;
};

describe("domain aliases: add", () => {
  it("opens the section and adds the alias typed in the modal of the + button", async () => {
    openAddModal();

    expect(await screen.findByText("old.example.com")).not.toBeNull();
    await waitFor(() => expect(mocks.api.addDomainAlias).toHaveBeenCalledWith("example.com", "new.example.com"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith({ title: "domains.aliases.added" });
  });

  it("keeps the modal open with the typed alias and shows a refusal in it", async () => {
    mocks.api.addDomainAlias.mockRejectedValue(new Error("Domain unknown"));
    const dialog = openAddModal();

    expect(await within(dialog).findByText("Domain unknown")).not.toBeNull();
    expect((within(dialog).getByLabelText("domains.domainName") as HTMLInputElement).value).toBe(" new.example.com ");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("says an alias already listed exists, whatever its case, instead of announcing its addition", async () => {
    render(<DomainAliases domain="example.com" />);
    fireEvent.click(screen.getByTitle("domains.aliases.addTooltip"));
    const dialog = screen.getByRole("dialog");
    await screen.findByText("old.example.com");
    fireEvent.change(within(dialog).getByLabelText("domains.domainName"), { target: { value: " Old.Example.COM " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      `domains.aliases.alreadyExists ${JSON.stringify({ source: "Old.Example.COM" })}`
    );
    expect(mocks.api.addDomainAlias).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
