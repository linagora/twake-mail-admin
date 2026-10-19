// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { message?: string }) => (options?.message ? `${key}: ${options.message}` : key) }),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
const api = vi.hoisted(() => ({ getHealthCheck: vi.fn() }));
vi.mock("./api-client", () => api);

import HealthCheck from "./index";

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

  it.each([
    ["Cassandra backend", "healthCheck.status.healthy"],
    ["EventDeadLettersHealthCheck", "healthCheck.status.degraded"],
    ["Redis", "healthCheck.status.unhealthy"],
  ])("writes out the status of %s, not only its card colour", async (component, status) => {
    render(<MemoryRouter><HealthCheck /></MemoryRouter>);

    const card = (await screen.findByText(component)).closest(".rounded-lg") as HTMLElement;
    expect(card.textContent).toBe(`${component}${status}`);
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
