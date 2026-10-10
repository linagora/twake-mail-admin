import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), getRaw: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: http.get, post: vi.fn(), delete: vi.fn() },
  getRaw: http.getRaw,
}));

import { searchDeadLetterEventByEventId } from "./api-client";

const EVENT_ID = "261b26a0-bf02-410b-90f0-53c9e8f8143e";
const GROUP = "org.apache.james.vault.Listener$Group";
const OTHER_GROUP = "org.apache.james.Other$Group";
const EVENT = { MailboxDeletion: { eventId: EVENT_ID, user: "bob" } };

const deadLetters: Record<string, Record<string, unknown>> = {
  [OTHER_GROUP]: { "other-1": { Added: { eventId: "another-event" } } },
  [GROUP]: {
    "insertion-1": { Added: { eventId: "yet-another-event" } },
    "insertion-2": EVENT,
  },
};

const serveDeadLetters = (url: string) => {
  if (url === "/events/deadLetter/groups")
    return Promise.resolve(Object.keys(deadLetters));
  const [group, insertionId] = url
    .replace("/events/deadLetter/groups/", "")
    .split("/")
    .map(decodeURIComponent);
  return Promise.resolve(
    insertionId
      ? deadLetters[group][insertionId]
      : Object.keys(deadLetters[group] ?? {})
  );
};

describe("searchDeadLetterEventByEventId", () => {
  beforeEach(() => {
    http.get.mockReset().mockImplementation(serveDeadLetters);
    http.getRaw.mockReset();
  });

  it("relies on the X-Group / X-Insertion-Id headers when they are readable", async () => {
    http.getRaw.mockResolvedValue({
      headers: { "x-group": GROUP, "x-insertion-id": "insertion-2" },
      data: EVENT,
    });

    const result = await searchDeadLetterEventByEventId(EVENT_ID);

    expect(result).toEqual({
      group: GROUP,
      insertionId: "insertion-2",
      json: EVENT,
    });
    expect(http.get).not.toHaveBeenCalled();
  });

  it("locates the event across groups when the headers are not exposed cross-origin", async () => {
    http.getRaw.mockResolvedValue({ headers: {}, data: EVENT });

    const result = await searchDeadLetterEventByEventId(EVENT_ID);

    expect(result).toEqual({
      group: GROUP,
      insertionId: "insertion-2",
      json: EVENT,
    });
  });

  it("only browses the requested group when one is given", async () => {
    http.getRaw.mockResolvedValue({ headers: {}, data: EVENT });

    const result = await searchDeadLetterEventByEventId(EVENT_ID, ` ${GROUP} `);

    expect(result.insertionId).toBe("insertion-2");
    expect(http.get).not.toHaveBeenCalledWith("/events/deadLetter/groups");
  });

  it("still shows the event when its location cannot be resolved", async () => {
    http.getRaw.mockResolvedValue({ headers: {}, data: EVENT });
    http.get.mockRejectedValue(new Error("forbidden"));

    const result = await searchDeadLetterEventByEventId(EVENT_ID);

    expect(result).toEqual({ group: "", insertionId: "", json: EVENT });
  });
});
