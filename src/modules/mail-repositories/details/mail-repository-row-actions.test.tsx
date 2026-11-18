// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactNode } from "react";

const REPOSITORY = "var/mail/error";
const MAIL_KEYS = ["mail-001", "mail-002"];

const http = vi.hoisted(() => ({ get: vi.fn() }));
const confirm = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock(import("@/lib/apiClient"), async (importOriginal) => ({
  ...(await importOriginal()),
  apiClient: { get: http.get } as never,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => confirm }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));

import MailRepositoryDetail from "./mail-repository";
import MailRepositoryExtended from "./mail-repository-extended";

const mailDetail = (name: string) => ({
  name,
  sender: "alice@example.com",
  recipients: ["bob@example.com"],
  state: "error",
  error: "",
  remoteHost: "",
  remoteAddr: "",
  lastUpdated: null,
});

function answer(url: string) {
  if (url === "/mailRepositories") return Promise.resolve([{ repository: REPOSITORY }, { repository: "var/mail/other" }]);
  if (url.includes("/mails?")) return Promise.resolve(MAIL_KEYS);
  return Promise.resolve(mailDetail(MAIL_KEYS.find((key) => url.endsWith(`/mails/${key}`)) ?? MAIL_KEYS[0]));
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mail-repositories/repository/:id" element={<MailRepositoryDetail />} />
        <Route path="/mail-repositories/repository/:id/extended" element={<MailRepositoryExtended />} />
      </Routes>
    </MemoryRouter>
  );
}

const named = (key: string) => `mailRepositories.${key} ${JSON.stringify({ item: "mail-002" })}`;

/** The text of the confirmation message last asked for, rendered when it is an element. */
function lastConfirmMessage(): string {
  const message: ReactNode = confirm.mock.lastCall?.[0].message;
  if (typeof message === "string") return message;
  const { container, unmount } = render(<>{message}</>);
  const text = container.textContent ?? "";
  unmount();
  return text;
}

beforeEach(() => {
  http.get.mockReset().mockImplementation(answer);
  confirm.mockReset().mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mail repository: row buttons and their confirmations", () => {
  it("names the reprocess, move and remove buttons after their mail, the tooltips staying short", async () => {
    renderAt(`/mail-repositories/repository/${encodeURIComponent(REPOSITORY)}`);

    const reprocess = await screen.findByRole("button", { name: named("reprocessMailNamed") });
    const move = screen.getByRole("button", { name: named("moveMailNamed") });
    const remove = screen.getByRole("button", { name: named("deleteMailNamed") });
    expect(reprocess.getAttribute("title")).toBe("mailRepositories.reprocessMailTooltip");
    expect(move.getAttribute("title")).toBe("mailRepositories.moveMailTooltip");
    expect(remove.getAttribute("title")).toBe("mailRepositories.deleteMailTooltip");
  });

  it("names the mail and its repository in the confirmations", async () => {
    renderAt(`/mail-repositories/repository/${encodeURIComponent(REPOSITORY)}`);

    fireEvent.click(await screen.findByRole("button", { name: named("deleteMailNamed") }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(lastConfirmMessage()).toBe(`mailRepositories.removeMailConfirm ${JSON.stringify({ mailKey: "mail-002", id: REPOSITORY })}`);

    fireEvent.click(screen.getByRole("button", { name: named("reprocessMailNamed") }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(lastConfirmMessage()).toContain(`mailRepositories.reprocessMailConfirm ${JSON.stringify({ mailKey: "mail-002" })}`);

    fireEvent.click(screen.getByRole("button", { name: named("moveMailNamed") }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(3));
    expect(lastConfirmMessage()).toContain(`mailRepositories.moveMailConfirm ${JSON.stringify({ mailKey: "mail-002" })}`);
  });
});

describe("mail repository extended view: row buttons and their confirmations", () => {
  it("names the download, reprocess, move and delete buttons after their mail, the tooltips staying short", async () => {
    renderAt(`/mail-repositories/repository/${encodeURIComponent(REPOSITORY)}/extended`);

    const download = await screen.findByRole("button", { name: named("downloadMailNamed") });
    const reprocess = screen.getByRole("button", { name: named("reprocessMailNamed") });
    const move = screen.getByRole("button", { name: named("moveMailNamed") });
    const remove = screen.getByRole("button", { name: named("deleteMailNamed") });
    expect(download.getAttribute("title")).toBe("mailRepositories.downloadTooltip");
    expect(reprocess.getAttribute("title")).toBe("mailRepositories.reprocessMailTooltip");
    expect(move.getAttribute("title")).toBe("mailRepositories.moveMailTooltip");
    expect(remove.getAttribute("title")).toBe("mailRepositories.deleteMailTooltip");
  });

  it("names the mail and its repository in the delete confirmation", async () => {
    renderAt(`/mail-repositories/repository/${encodeURIComponent(REPOSITORY)}/extended`);

    fireEvent.click(await screen.findByRole("button", { name: named("deleteMailNamed") }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(lastConfirmMessage()).toBe(`mailRepositories.deleteMailConfirm ${JSON.stringify({ mailKey: "mail-002", id: REPOSITORY })}`);
  });
});
