import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { patch: http.patch },
}));

import { moveAllMails, moveSingleMail, reprocessMailRepository } from "./api-client";

const error = { repository: "var/mail/error", path: "var%2Fmail%2Ferror" };
const qaRepo = { repository: "var/mail/qa-repo", path: "var%2Fmail%2Fqa-repo" };

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

  it("defaults to the root processor", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror");
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&processor=root"
    );
  });

  it("sends the processor once and drops blank parameters", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", {
      queue: "spool",
      processor: "transport",
      consume: true,
      limit: "" as unknown as number,
      maxRetries: "" as unknown as number,
    });
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&processor=transport&queue=spool&consume=true"
    );
  });

  it("keeps numeric limits", async () => {
    await reprocessMailRepository("var%2Fmail%2Ferror", { limit: 10, maxRetries: 3 });
    expect(http.patch).toHaveBeenCalledWith(
      "/mailRepositories/var%2Fmail%2Ferror/mails?action=reprocess&processor=root&limit=10&maxRetries=3"
    );
  });
});
