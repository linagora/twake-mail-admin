import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: http.post, delete: vi.fn() },
  getRaw: vi.fn(),
}));

import {
  deleteAllUnsentMails,
  getUnsentMailIds,
  resendAllUnsentMails,
} from "./api-client";

describe("unsent mails bulk routes", () => {
  beforeEach(() => {
    http.get.mockReset().mockResolvedValue([]);
    http.post.mockReset().mockResolvedValue({ taskId: "task-1" });
  });

  it("plans a deletion task on the route the resend task already uses", async () => {
    await deleteAllUnsentMails();
    expect(http.post).toHaveBeenCalledWith("/unsentMails?action=delete");
  });

  it("carries the page filters over to the deletion task", async () => {
    await deleteAllUnsentMails({ sender: "a@b.com", recipient: "c@d.com" });
    expect(http.post).toHaveBeenCalledWith(
      "/unsentMails?action=delete&sender=a%40b.com&recipient=c%40d.com"
    );
  });

  it("selects the mails to resend the very same way", async () => {
    await resendAllUnsentMails({ sender: "a@b.com" });
    expect(http.post).toHaveBeenCalledWith(
      "/unsentMails?action=resend&sender=a%40b.com"
    );
  });

  it("omits the empty criteria rather than filtering on a blank address", async () => {
    await deleteAllUnsentMails({ sender: undefined, recipient: "" });
    expect(http.post).toHaveBeenCalledWith("/unsentMails?action=delete");
  });

  it("lists without a query string when nothing is selected", async () => {
    await getUnsentMailIds();
    expect(http.get).toHaveBeenCalledWith("/unsentMails");
  });
});
