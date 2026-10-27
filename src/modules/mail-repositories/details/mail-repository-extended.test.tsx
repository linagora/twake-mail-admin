// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock(import("@/lib/apiClient"), async (importOriginal) => ({
  ...(await importOriginal()),
  apiClient: { get: http.get } as never,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
// The keys as text; the labelled key wraps its label
const t = vi.hoisted(() => (key: string, options?: Record<string, unknown>) =>
  key === "tasks.labelled" ? `labelled(${options?.label})` : key);
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import MailRepositoryExtended from "./mail-repository-extended";

const mailDetail = {
  name: "mail-001",
  sender: "qa@example.com",
  recipients: ["bob@example.com"],
  state: "error",
  error: "",
  remoteHost: "",
  remoteAddr: "",
  lastUpdated: null,
};

function answer(url: string) {
  if (url === "/mailRepositories") return Promise.resolve([{ repository: "var/mail/error" }]);
  if (url.includes("/mails?")) return Promise.resolve([mailDetail.name]);
  return Promise.resolve(mailDetail);
}

function renderExtended() {
  render(
    <MemoryRouter initialEntries={["/mail-repositories/repository/var%2Fmail%2Ferror/extended?size=1"]}>
      <Routes>
        <Route path="/mail-repositories/repository/:id/extended" element={<MailRepositoryExtended />} />
      </Routes>
    </MemoryRouter>
  );
}

const columnClasses = (element: HTMLElement) =>
  Array.from(element.classList).filter((name) => name.includes("grid-cols-"));

beforeEach(() => {
  http.get.mockReset().mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mail repository extended view: layout", () => {
  it("lays the header and the rows out on the same column template", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");

    expect(columnClasses(row)).not.toEqual([]);
    expect(columnClasses(screen.getByTestId("mail-repository-extended-header"))).toEqual(columnClasses(row));
  });

  it("hides the header below md, where the rows stack their fields", async () => {
    renderExtended();
    await screen.findByTestId("mail-repository-extended-row");

    const header = screen.getByTestId("mail-repository-extended-header");

    expect(header.classList).toContain("hidden");
    expect(header.classList).toContain("md:grid");
  });

  it("labels the recipients, the date and the size of a stacked row", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");

    expect(within(row).getByText("labelled(mailRepositories.colRecipients)")).not.toBeNull();
    expect(within(row).getByText("labelled(mailRepositories.colLastUpdated)")).not.toBeNull();
    expect(within(row).getByText("labelled(mailRepositories.colSize)")).not.toBeNull();
    expect(within(row).getByText("labelled(mailRepositories.colRecipients)").parentElement!.textContent)
      .toContain("bob@example.com");
  });

  it("keeps each stacked value in an element of its own, apart from its label", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");

    // The e2e suite reads the size as /^\d+ B$/: the label must not be part of its element
    expect(within(row).getByText(/^\d+ /).textContent).toMatch(/^\d+ /);
    expect(within(row).getByText("bob@example.com").textContent).toBe("bob@example.com");
  });

  it("only truncates the name, sender and recipients from the md breakpoint", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");
    const nameCell = within(row).getByText("mail-001").parentElement!;
    const recipientsCell = within(row).getByText("labelled(mailRepositories.colRecipients)").parentElement!;

    [nameCell, recipientsCell].forEach((cell) => {
      expect(cell.classList).not.toContain("truncate");
      expect(cell.classList).toContain("md:truncate");
    });
  });
});
