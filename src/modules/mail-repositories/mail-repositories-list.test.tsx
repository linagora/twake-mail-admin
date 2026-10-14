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

    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: "mailRepositories.runTaskError",
      description: "repository not found",
      variant: "destructive",
    }));
  });

  it("links the started task on success", async () => {
    api.clearMailRepository.mockResolvedValue({ taskId: "task-1" });
    await clickAction("mailRepositories.clearAll");

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "mailRepositories.runTaskSuccess",
    })));
    expect(api.clearMailRepository).toHaveBeenCalledWith("var%2Fmail%2Ferror");
  });
});
