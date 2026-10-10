// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AxiosError, AxiosHeaders } from "axios";

const REPOSITORIES = [{ repository: "error", path: "var/mail/error" }];

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
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => () => Promise.resolve(true) }));
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
});

afterEach(cleanup);

describe("mail repositories list tasks", () => {
  it("reports a refused reprocessing with the WebAdmin reason", async () => {
    api.reprocessMailRepository.mockRejectedValue(webAdminRefusal("unknown processor"));
    await clickAction("mailRepositories.reprocessAll");

    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: "mailRepositories.runTaskError",
      description: "unknown processor",
      variant: "destructive",
    }));
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
    expect(api.clearMailRepository).toHaveBeenCalledWith("var/mail/error");
  });
});
