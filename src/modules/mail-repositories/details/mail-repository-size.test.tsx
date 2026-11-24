// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock(import("@/lib/apiClient"), async (importOriginal) => ({
  ...(await importOriginal()),
  apiClient: { get: http.get } as never,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
const t = vi.hoisted(() => (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key);
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import MailRepositoryDetail from "./mail-repository";
import MailRepositoryExtended from "./mail-repository-extended";

const REPOSITORY_URL = "/mailRepositories/var%2Fmail%2Ferror";
const MAIL_COUNT = 450;
const mailKeys = Array.from({ length: MAIL_COUNT }, (_, index) => `mail-${String(index + 1).padStart(3, "0")}`);

const pageOfKeys = (url: string): string[] => {
  const params = new URLSearchParams(url.split("?")[1]);
  const offset = Number(params.get("offset"));
  return mailKeys.slice(offset, offset + Number(params.get("limit")));
};

const mailDetail = (name: string) => ({
  name, sender: "qa@example.com", recipients: [], state: "error", error: "", remoteHost: "", remoteAddr: "", lastUpdated: null,
});

function answer(url: string) {
  if (url === "/mailRepositories") return Promise.resolve([{ repository: "var/mail/error" }]);
  if (url === REPOSITORY_URL) return Promise.resolve({ repository: "var/mail/error", path: "var%2Fmail%2Ferror", size: MAIL_COUNT });
  if (url.includes("/mails?")) return Promise.resolve(pageOfKeys(url));
  return Promise.resolve(mailDetail(url.split("/").pop()!));
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

const pageLabel = (page: number, totalPages: number, total: number) =>
  `common.page ${JSON.stringify({ page, totalPages, total })}`;

beforeEach(() => {
  http.get.mockReset().mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mail repository: size read from WebAdmin", () => {
  it("pages through the repository opened without a size in the URL, e.g. from the Health Check", async () => {
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror");

    expect(await screen.findByText(pageLabel(1, 3, MAIL_COUNT))).toBeTruthy();
    expect(http.get).toHaveBeenCalledWith(REPOSITORY_URL);
    expect((screen.getByRole("button", { name: "common.next" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "common.last" })).toBeTruthy();
  });

  it("prefers the size of WebAdmin to a stale size of the URL", async () => {
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror?page=1&size=3");

    expect(await screen.findByText(pageLabel(1, 3, MAIL_COUNT))).toBeTruthy();
  });

  it("keeps the size of the URL when WebAdmin cannot tell it", async () => {
    http.get.mockImplementation((url: string) =>
      url === REPOSITORY_URL ? Promise.reject(new Error("forbidden")) : answer(url));
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror?page=1&size=450");

    expect(await screen.findByText(pageLabel(1, 3, MAIL_COUNT))).toBeTruthy();
  });

  it("offers the next page of an unknown size after a full page, with no last page", async () => {
    http.get.mockImplementation((url: string) =>
      url === REPOSITORY_URL ? Promise.reject(new Error("forbidden")) : answer(url));
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror");

    expect(await screen.findByText(`common.pageOf ${JSON.stringify({ page: 1, count: 200 })}+`)).toBeTruthy();
    expect((screen.getByRole("button", { name: "common.next" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "common.last" })).toBeNull();
  });

  it("pages the Extended view opened without a size in the URL, e.g. from its breadcrumb", async () => {
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror/extended");

    expect(await screen.findByText(pageLabel(1, 9, MAIL_COUNT))).toBeTruthy();
  });
});
