// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";

const REPOSITORIES = [
  { repository: "var/mail/error", path: "var%2Fmail%2Ferror" },
  { repository: "var/mail/relay-denied", path: "var%2Fmail%2Frelay-denied" },
];

vi.mock("./api-client", () => ({
  getMailRepositories: vi.fn(),
  getRepositoryInfo: vi.fn().mockResolvedValue({ size: 3 }),
  reprocessMailRepository: vi.fn(),
  clearMailRepository: vi.fn(),
  moveAllMails: vi.fn(),
}));
vi.mock("./create-mail-repository-button", () => ({ default: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-fetch-data", () => ({
  useFetchData: () => ({ data: REPOSITORIES, isLoading: false, refresh: vi.fn() }),
}));

import MailRepositoriesList from "./mail-repositories-list";

beforeAll(() => i18n.changeLanguage("en"));

afterEach(cleanup);

describe("mail repositories list: bulk action names", () => {
  it("names each bulk action after the repository it acts on", async () => {
    render(
      <MemoryRouter>
        <MailRepositoriesList />
      </MemoryRouter>
    );

    await screen.findAllByRole("button", { name: /^Reprocess all mails of / });
    const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual(expect.arrayContaining([
      'Reprocess all mails of "var/mail/error"',
      'Move all mails of "var/mail/error" to another repository',
      'Clear all mails of "var/mail/error"',
      'Reprocess all mails of "var/mail/relay-denied"',
      'Move all mails of "var/mail/relay-denied" to another repository',
      'Clear all mails of "var/mail/relay-denied"',
    ]));
  });
});
