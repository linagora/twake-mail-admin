// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { ConfirmProvider } from "@/components/custom/confirm-provider";
import { useConfirm } from "@/hooks/use-confirm";

const http = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, patch: http.patch },
}));

import ReprocessTaskContent from "./reprocess-task-content";
import { isUnknownQueue } from "./mail-queues";
import { reprocessMailRepository, reprocessSingleMail } from "./api-client";

const REPOSITORY = "var%2Fmail%2Ferror";
const QUEUES = ["spool", "outgoing"];
const SERVER_MESSAGE = "Can not find queue unknown";

const PARAMS = [
  { key: "queue", defaultValue: "spool", type: "input" as const },
  { key: "processor", defaultValue: "", type: "input" as const },
];

const unknownQueueAnswer = () =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 400, type: "InvalidArgument", message: SERVER_MESSAGE },
  });

type Reprocess = (values: Record<string, string>) => Promise<{ taskId: string }>;

const ROUTES: Array<[string, Reprocess]> = [
  ["all mails", (values) => reprocessMailRepository(REPOSITORY, values)],
  ["one mail", (values) => reprocessSingleMail(REPOSITORY, "mail-001", values)],
];

function Opener({ reprocess, onTask }: { reprocess: Reprocess; onTask: (taskId: string) => void }) {
  const confirm = useConfirm();
  const open = () => {
    const values: Record<string, string> = {};
    confirm({
      header: "Reprocess",
      message: (
        <ReprocessTaskContent
          message={<p>Reprocess?</p>}
          command={`curl -XPATCH '/mailRepositories/${REPOSITORY}/mails?action=reprocess'`}
          params={PARAMS}
          getParamValues={(key, value) => { values[key] = String(value); }}
        />
      ),
      action: async () => onTask((await reprocess(values)).taskId),
    });
  };
  return <button onClick={open}>open</button>;
}

const openDialog = (reprocess: Reprocess = ROUTES[0][1], onTask: (taskId: string) => void = vi.fn()) => {
  render(<ConfirmProvider><Opener reprocess={reprocess} onTask={onTask} /></ConfirmProvider>);
  fireEvent.click(screen.getByText("open"));
};

const queueField = () => screen.getByLabelText(/^queue/) as HTMLInputElement;
const typeQueue = (queue: string) => fireEvent.change(queueField(), { target: { value: queue } });
const suggestedQueues = () =>
  Array.from(document.querySelectorAll(`datalist#${CSS.escape(queueField().getAttribute("list") ?? "")} option`))
    .map((option) => option.getAttribute("value"));
const preview = () => screen.getByText(/curl -XPATCH/).textContent;

beforeEach(() => {
  http.get.mockReset().mockImplementation((url: string) =>
    url === "/mailQueues" ? Promise.resolve(QUEUES) : Promise.reject(new Error(url)));
  http.patch.mockReset().mockResolvedValue({ taskId: "task-1" });
});

afterEach(cleanup);

describe("reprocessing dialog: queue picker", () => {
  it("suggests the queues listed by GET /mailQueues, spool selected", async () => {
    openDialog();

    await waitFor(() => expect(suggestedQueues()).toEqual(QUEUES));
    expect(http.get).toHaveBeenCalledWith("/mailQueues");
    expect(queueField().value).toBe("spool");
  });

  it("warns about a typed queue that does not exist, and not about an existing one", async () => {
    openDialog();
    await waitFor(() => expect(suggestedQueues()).toEqual(QUEUES));

    typeQueue("unknown");
    expect(screen.getByRole("status").textContent).toContain("mailRepositories.unknownQueue");

    typeQueue("outgoing");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the command preview in sync with the chosen queue", async () => {
    openDialog();
    await screen.findByText(/curl -XPATCH/);

    typeQueue("outgoing");

    expect(preview()).toContain("queue=outgoing");
  });

  it("falls back to free text, without warning, when the queues cannot be listed", async () => {
    http.get.mockRejectedValue(new Error("403"));
    openDialog();
    await waitFor(() => expect(http.get).toHaveBeenCalledWith("/mailQueues"));

    typeQueue("custom");

    expect(queueField().getAttribute("list")).toBeNull();
    expect(queueField().value).toBe("custom");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe.each(ROUTES)("reprocessing %s into an unknown queue", (_name, reprocess) => {
  it("keeps the dialog open with the typed values and the server message, announcing no task", async () => {
    http.patch.mockRejectedValue(unknownQueueAnswer());
    const onTask = vi.fn();
    openDialog(reprocess, onTask);
    await waitFor(() => expect(suggestedQueues()).toEqual(QUEUES));
    typeQueue("unknown");

    fireEvent.click(screen.getByText("confirmTask.start"));

    expect((await screen.findByRole("alert")).textContent).toContain(SERVER_MESSAGE);
    expect(http.patch.mock.lastCall?.[0]).toContain("queue=unknown");
    expect(queueField().value).toBe("unknown");
    expect(onTask).not.toHaveBeenCalled();
  });
});

describe("isUnknownQueue", () => {
  it("only flags a non blank queue missing from a loaded list", () => {
    expect(isUnknownQueue("unknown", QUEUES)).toBe(true);
    expect(isUnknownQueue(" spool ", QUEUES)).toBe(false);
    expect(isUnknownQueue("", QUEUES)).toBe(false);
    expect(isUnknownQueue("unknown", null)).toBe(false);
  });
});
