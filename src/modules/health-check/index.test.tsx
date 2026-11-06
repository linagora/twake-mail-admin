// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.message ? `${key}: ${options.message}` : options && "count" in options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
const api = vi.hoisted(() => ({ getHealthCheck: vi.fn() }));
vi.mock("./api-client", () => api);

import HealthCheck from "./index";

const banner = async () => (await screen.findByText(/healthCheck\.summary\./)).closest('[role="status"]') as HTMLElement;

afterEach(cleanup);

const answer = {
  status: "unhealthy",
  checks: [
    { componentName: "Cassandra backend", escapedComponentName: "Cassandra%20backend", status: "healthy" },
    { componentName: "EventDeadLettersHealthCheck", escapedComponentName: "EventDeadLettersHealthCheck", status: "degraded", cause: "EventDeadLetters contain events." },
    { componentName: "Redis", escapedComponentName: "Redis", status: "unhealthy" },
  ],
};

describe("health check: component status", () => {
  beforeEach(() => {
    api.getHealthCheck.mockReset().mockResolvedValue(answer);
  });

  const card = async (component: string) => {
    await banner();
    const sections = Array.from(document.querySelectorAll("section"));
    const name = sections.flatMap((section) => within(section).queryAllByText(component))[0];
    return name.closest(".rounded-lg") as HTMLElement;
  };

  it.each([
    ["Cassandra backend", "healthCheck.status.healthy"],
    ["EventDeadLettersHealthCheck", "healthCheck.status.degradedEventDeadLetters contain events.healthCheck.open →"],
    ["Redis", "healthCheck.status.unhealthy"],
  ])("writes out the status of %s, and its cause, not only its card colour", async (component, rest) => {
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    expect((await card(component)).textContent).toBe(`${component}${rest}`);
  });

  it("links a card to the screen that fixes its component", async () => {
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    expect((await card("EventDeadLettersHealthCheck")).closest("a")?.getAttribute("href")).toBe("/event-dead-letter");
    expect((await card("Cassandra backend")).closest("a")).toBeNull();
  });

  it("states how many components need attention, and why, with where to go", async () => {
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    const summary = await banner();
    expect(summary.textContent).toContain(`healthCheck.summary.problems ${JSON.stringify({
      unhealthy: 1,
      degraded: 'healthCheck.summary.degraded {"count":1}',
      count: 3,
    })}`);
    const lines = within(summary).getAllByRole("listitem").map((li) => li.textContent);
    expect(lines).toEqual([
      "Redis — healthCheck.status.unhealthy",
      "EventDeadLettersHealthCheck — healthCheck.status.degraded — EventDeadLetters contain events. healthCheck.open →",
    ]);
    expect(within(summary).getByRole("link").getAttribute("href")).toBe("/event-dead-letter");
  });

  it("checks again on demand, keeping the cards meanwhile", async () => {
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);
    await banner();
    api.getHealthCheck.mockReturnValue(new Promise(() => {}));

    fireEvent.click(screen.getByText("healthCheck.refresh"));

    await waitFor(() => expect(api.getHealthCheck).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Cassandra backend").length).toBeGreaterThan(0);
  });
});

describe("health check: all healthy", () => {
  it("says so in a single line", async () => {
    api.getHealthCheck.mockReset().mockResolvedValue({
      status: "healthy",
      checks: [{ componentName: "Redis", escapedComponentName: "Redis", status: "healthy" }],
    });
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    expect((await banner()).textContent).toContain('healthCheck.summary.healthy {"count":1}');
  });
});

describe("health check: loading and failure", () => {
  it("tells the operator the components are being checked", async () => {
    api.getHealthCheck.mockReset().mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    expect((await screen.findByRole("status")).textContent).toBe("healthCheck.checking");
  });

  it("shows the error when the request really fails", async () => {
    api.getHealthCheck.mockReset().mockRejectedValue(new Error("Network Error"));
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    expect((await screen.findByRole("alert")).textContent).toContain("Network Error");
  });
});

describe("health check: component names", () => {
  it("offers a line break between the words of a CamelCase name only", async () => {
    api.getHealthCheck.mockReset().mockResolvedValue({
      status: "healthy",
      checks: [{ componentName: "RabbitMQDeadLetterQueues", escapedComponentName: "RabbitMQDeadLetterQueues", status: "healthy" }],
    });
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    const name = await screen.findByText("RabbitMQDeadLetterQueues");
    expect(name.innerHTML).toBe("Rabbit<wbr>MQ<wbr>Dead<wbr>Letter<wbr>Queues");
  });
});
