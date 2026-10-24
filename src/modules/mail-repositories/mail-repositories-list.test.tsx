// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError, AxiosHeaders } from "axios";
import { ReactNode } from "react";

const REPOSITORIES = [{ repository: "var/mail/error", path: "var%2Fmail%2Ferror" }];

const api = vi.hoisted(() => ({
  getMailRepositories: vi.fn(),
  getRepositoryInfo: vi.fn(),
  reprocessMailRepository: vi.fn(),
  clearMailRepository: vi.fn(),
  moveAllMails: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("./api-client", () => api);
vi.mock("./create-mail-repository-button", () => ({ default: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const confirmed = vi.hoisted(() => ({ message: undefined as ReactNode, actionError: undefined as unknown }));
vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => async (options: { message: ReactNode; action?: () => Promise<unknown> }) => {
    confirmed.message = options.message;
    // Like the confirm dialog: a failed action is reported in the dialog, which stays open
    try {
      await options.action?.();
      return true;
    } catch (err) {
      confirmed.actionError = err;
      return false;
    }
  },
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-fetch-data", () => ({
  useFetchData: () => ({ data: REPOSITORIES, isLoading: false, refresh: vi.fn() }),
}));

import MailRepositoriesList from "./mail-repositories-list";

const webAdminRefusal = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { type: "InvalidArgument", message },
  });

const clickAction = async (title: string) => {
  render(
    <MemoryRouter>
      <MailRepositoriesList />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByTitle(title));
};

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getRepositoryInfo.mockResolvedValue({ size: 3 });
  toast.mockReset();
  confirmed.actionError = undefined;
});

afterEach(cleanup);

describe("mail repositories list tasks", () => {
  it("reports a refused reprocessing in the dialog", async () => {
    const refusal = webAdminRefusal("unknown processor");
    api.reprocessMailRepository.mockRejectedValue(refusal);
    await clickAction("mailRepositories.reprocessAll");

    await waitFor(() => expect(confirmed.actionError).toBe(refusal));
    expect(toast).not.toHaveBeenCalled();
  });

  it("previews the reprocessing request actually sent for the repository", async () => {
    api.reprocessMailRepository.mockResolvedValue({ taskId: "task-1" });
    await clickAction("mailRepositories.reprocessAll");
    await waitFor(() => expect(api.reprocessMailRepository).toHaveBeenCalled());
    cleanup();

    render(<>{confirmed.message}</>);

    expect(screen.getByText(/curl -XPATCH/).textContent).toContain(
      "curl -XPATCH /mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&queue=spool&processor=root&consume=true"
    );
  });

  it("reports a refused clear with the WebAdmin reason", async () => {
    api.clearMailRepository.mockRejectedValue(webAdminRefusal("repository not found"));
    await clickAction("mailRepositories.clearAll");

    // The server message, labelled and selectable as in every error display
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "mailRepositories.runTaskError", variant: "destructive" })));
    render(<>{toast.mock.calls[0][0].description}</>);
    expect(screen.getByText("common.serverMessage")).not.toBeNull();
    expect(screen.getByText("repository not found")).not.toBeNull();
  });

  it("links the started task on success", async () => {
    api.clearMailRepository.mockResolvedValue({ taskId: "task-1" });
    await clickAction("mailRepositories.clearAll");

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "common.taskCreated",
    })));
    expect(api.clearMailRepository).toHaveBeenCalledWith("var%2Fmail%2Ferror");
  });
});

describe("mail repositories list: links", () => {
  it("opens the repository details with a clean query string", async () => {
    render(
      <MemoryRouter>
        <MailRepositoriesList />
      </MemoryRouter>
    );

    expect((await screen.findByRole("link", { name: "var/mail/error" })).getAttribute("href")).toBe(
      "/mail-repositories/repository/var%2Fmail%2Ferror?page=1&size=3"
    );
  });
});

describe("mail repositories list: order and filter", () => {
  afterEach(() => {
    REPOSITORIES.splice(1);
  });

  it("lists the repositories holding mails first, then filters them on their path", async () => {
    REPOSITORIES.push(
      { repository: "var/mail/address-error", path: "var%2Fmail%2Faddress-error" },
      { repository: "var/mail/relay-denied", path: "var%2Fmail%2Frelay-denied" },
    );
    api.getRepositoryInfo.mockImplementation(async (path: string) => ({ size: path.includes("relay") ? 2 : 0 }));
    render(
      <MemoryRouter>
        <MailRepositoriesList />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "var/mail/relay-denied", "var/mail/address-error", "var/mail/error",
    ]));

    fireEvent.change(screen.getByLabelText("mailRepositories.filterPlaceholder"), { target: { value: "error" } });

    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["var/mail/address-error", "var/mail/error"]);
  });
});

describe("mail repositories list: move all mails", () => {
  afterEach(() => {
    REPOSITORIES.splice(1);
  });

  it("names the destination select after the move prompt", async () => {
    REPOSITORIES.push({ repository: "var/mail/qa-repo", path: "var%2Fmail%2Fqa-repo" });
    api.moveAllMails.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <MailRepositoriesList />
      </MemoryRouter>
    );
    fireEvent.click((await screen.findAllByTitle("mailRepositories.moveAll"))[0]);
    await waitFor(() => expect(api.moveAllMails).toHaveBeenCalled());
    cleanup();

    render(<>{confirmed.message}</>);

    expect(screen.getByLabelText("mailRepositories.moveConfirm").tagName).toBe("SELECT");
  });
});

describe("mail repositories list: empty repositories", () => {
  it("disables reprocess, move and clear on an empty repository and says why", async () => {
    api.getRepositoryInfo.mockResolvedValue({ size: 0 });
    render(
      <MemoryRouter>
        <MailRepositoriesList />
      </MemoryRouter>
    );

    const buttons = await screen.findAllByTitle("mailRepositories.emptyActionDisabled");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not repeat the URL-encoded path of a repository", async () => {
    render(
      <MemoryRouter>
        <MailRepositoriesList />
      </MemoryRouter>
    );
    await screen.findAllByTitle("mailRepositories.reprocessAll");
    expect(screen.queryByText(/%2F/)).toBeNull();
  });
});
