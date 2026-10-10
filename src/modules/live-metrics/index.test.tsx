// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({ getMetrics: vi.fn<() => Promise<string>>() }));

vi.mock("./api-client", () => api);

import LiveMetrics from "./index";

const METRICS = [
  "# HELP jvm_threads_current Current thread count",
  "# TYPE jvm_threads_current gauge",
  "jvm_threads_current 42",
].join("\n");

function renderPage() {
  render(
    <MemoryRouter>
      <LiveMetrics />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  api.getMetrics.mockReset();
});

describe("live metrics", () => {
  it("shows the load error when /metrics fails", async () => {
    api.getMetrics.mockRejectedValue(new Error("Request failed with status code 404"));
    renderPage();
    expect(await screen.findByText("common.errorPrefix")).not.toBeNull();
    expect(screen.queryByText("liveMetrics.empty")).toBeNull();
  });

  it("shows an empty state when the server returns no metric", async () => {
    api.getMetrics.mockResolvedValue("");
    renderPage();
    expect(await screen.findByText("liveMetrics.empty")).not.toBeNull();
  });

  it("tells when the filter matches no metric", async () => {
    api.getMetrics.mockResolvedValue(METRICS);
    renderPage();
    expect(await screen.findByText("jvm_threads_current")).not.toBeNull();
    fireEvent.change(screen.getByPlaceholderText("liveMetrics.filterPlaceholder"), { target: { value: "nope" } });
    expect(screen.queryByText("liveMetrics.noMatch")).not.toBeNull();
    expect(screen.queryByText("jvm_threads_current")).toBeNull();
  });

  it("gives the refresh button an accessible name", async () => {
    api.getMetrics.mockResolvedValue(METRICS);
    renderPage();
    await screen.findByText("jvm_threads_current");
    expect(screen.getByRole("button", { name: "liveMetrics.refresh" })).not.toBeNull();
  });
});
