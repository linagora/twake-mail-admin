// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const MAIL_KEY = "mail-1";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock(import("@/lib/apiClient"), async (importOriginal) => ({
  ...(await importOriginal()),
  apiClient: { get: http.get } as never,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));

import MailRepositoryDetail from "./mail-repository";
import MailRepositoryExtended from "./mail-repository-extended";

const mailDetail = {
  name: MAIL_KEY,
  sender: "alice@example.com",
  recipients: ["bob@example.com"],
  state: "error",
  error: "",
  remoteHost: "",
  remoteAddr: "",
  lastUpdated: null,
};

function answer(url: string, config?: { headers?: { Accept?: string } }) {
  if (url === "/mailRepositories") return Promise.resolve([{ repository: "var/mail/error" }]);
  if (url.includes("/mails?")) return Promise.resolve([MAIL_KEY]);
  if (config?.headers?.Accept === "message/rfc822") return Promise.resolve(new Blob(["Subject: hi"]));
  return Promise.resolve(mailDetail);
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

let downloadedNames: string[];

beforeEach(() => {
  http.get.mockReset().mockImplementation(answer);
  window.URL.createObjectURL = vi.fn(() => "blob:mail");
  window.URL.revokeObjectURL = vi.fn();
  downloadedNames = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloadedNames.push(this.getAttribute("download") ?? "");
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mail repository: MIME download", () => {
  it("downloads the mail as <mailKey>.eml and revokes its object URL", async () => {
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror?size=1");
    fireEvent.click(await screen.findByText("(MIME)"));

    await waitFor(() => expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mail"));
    expect(downloadedNames).toEqual([`${MAIL_KEY}.eml`]);
  });
});

describe("mail repository extended view: download", () => {
  it("downloads the mail as <mailKey>.eml and revokes its object URL", async () => {
    renderAt("/mail-repositories/repository/var%2Fmail%2Ferror/extended?size=1");
    fireEvent.click(await screen.findByTitle("mailRepositories.downloadTooltip"));

    await waitFor(() => expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mail"));
    expect(downloadedNames).toEqual([`${MAIL_KEY}.eml`]);
  });
});
