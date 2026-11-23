import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), put: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, patch: http.patch, put: http.put },
}));

import {
  createMailRepository,
  getMailRepositories,
  moveAllMails,
  moveSingleMail,
  reprocessMailRepository,
  reprocessSingleMail,
} from "./api-client";

const error = { repository: "var/mail/error", path: "var%2Fmail%2Ferror" };
const qaRepo = { repository: "var/mail/qa-repo", path: "var%2Fmail%2Fqa-repo" };

describe("mail repositories listing", () => {
  it("rebuilds the form-encoded path of a repository with a space as a URL path segment", async () => {
    http.get.mockResolvedValue([{ repository: "var/mail/qa space", path: "var%2Fmail%2Fqa+space" }]);

    expect(await getMailRepositories()).toEqual([
      { repository: "var/mail/qa space", path: "var%2Fmail%2Fqa%20space" },
    ]);
  });

  it("encodes a literal plus of the repository name", async () => {
    http.get.mockResolvedValue([{ repository: "var/mail/a+b", path: "var%2Fmail%2Fa%2Bb" }]);

    expect(await getMailRepositories()).toEqual([
      { repository: "var/mail/a+b", path: "var%2Fmail%2Fa%2Bb" },
    ]);
  });
});

describe("mail repository creation", () => {
  beforeEach(() => {
    http.put.mockReset().mockResolvedValue(undefined);
  });

  it("always sends the protocol, encoded, as WebAdmin requires it", async () => {
    await createMailRepository("var%2Fmail%2Fnew", "my proto");

    expect(http.put).toHaveBeenCalledWith("/mailRepositories/var%2Fmail%2Fnew?protocol=my%20proto");
  });
});

describe("mail repository moves", () => {
  beforeEach(() => {
    http.patch.mockReset().mockResolvedValue(undefined);
  });

  it("addresses the source by its already encoded path, without encoding it twice", async () => {
    await moveAllMails(error, qaRepo);
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails",
      expect.anything()
    );
  });

  it("names the target of a bulk move by its plain repository, not its encoded path", async () => {
    await moveAllMails(error, qaRepo);
    expect(http.patch).toHaveBeenCalledWith(expect.any(String), {
      mailRepository: "var/mail/qa-repo",
    });
  });

  it("names the target of a single mail move by its plain repository too", async () => {
    await moveSingleMail("var%2Fmail%2Ferror", "mail-1", qaRepo);
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails/mail-1",
      { mailRepository: "var/mail/qa-repo" }
    );
  });
});

describe("reprocess mail repository", () => {
  beforeEach(() => {
    http.patch.mockReset().mockResolvedValue({ taskId: "task-1" });
  });

  it("leaves the processor out by default, each mail going back to its stored state", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror");
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess"
    );
  });

  it("sends the processor once and drops blank parameters", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", {
      queue: "spool",
      processor: "transport",
      consume: true,
      limit: "",
      maxRetries: "",
    });
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&queue=spool&processor=transport&consume=true"
    );
  });

  it("trims the processor and leaves a blank one out", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", { queue: " spool ", processor: " transport " });
    await reprocessMailRepository("var%2Fmail%2Ferror", { processor: "   " });
    expect(http.patch.mock.calls.map(([url]) => url)).toEqual([
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&queue=spool&processor=transport",
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess",
    ]);
  });

  it("keeps numeric limits", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", { limit: 10, maxRetries: 3 });
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&limit=10&maxRetries=3"
    );
  });
});

describe("reprocess a single mail", () => {
  beforeEach(() => {
    http.patch.mockReset().mockResolvedValue({ taskId: "task-1" });
  });

  it("trims the queue and processor and leaves blank ones out", async () => {
    await reprocessSingleMail("var%2Fmail%2Ferror", "mail-1", { queue: " spool ", processor: " transport " });
    await reprocessSingleMail("var%2Fmail%2Ferror", "mail-1", { queue: "", processor: "  " });
    expect(http.patch.mock.calls.map(([url]) => url)).toEqual([
      "/mailRepositories/var%2Fmail%2Ferror/mails/mail-1?action=reprocess&queue=spool&processor=transport",
      "/mailRepositories/var%2Fmail%2Ferror/mails/mail-1?action=reprocess",
    ]);
  });
});
