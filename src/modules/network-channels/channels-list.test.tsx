// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({
  getAllChannels: vi.fn(() => Promise.resolve([])),
  disconnectAllChannels: vi.fn(),
}));

vi.mock("./api-client", () => api);
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));

import ChannelsList from "./channels-list";

afterEach(cleanup);

describe("network channels list", () => {
  it("names the refresh button", async () => {
    render(
      <MemoryRouter>
        <ChannelsList />
      </MemoryRouter>
    );

    const refresh = await screen.findByRole("button", { name: "common.refresh" });

    expect(refresh.getAttribute("title")).toBe("common.refresh");
  });
});
