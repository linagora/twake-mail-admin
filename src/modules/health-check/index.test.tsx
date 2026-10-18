// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL" } }));
vi.mock("./api-client", () => ({
  getHealthCheck: async () => ({
    status: "unhealthy",
    checks: [
      { componentName: "Cassandra backend", escapedComponentName: "Cassandra%20backend", status: "healthy" },
      { componentName: "EventDeadLettersHealthCheck", escapedComponentName: "EventDeadLettersHealthCheck", status: "degraded", cause: "EventDeadLetters contain events." },
      { componentName: "Redis", escapedComponentName: "Redis", status: "unhealthy" },
    ],
  }),
}));

import HealthCheck from "./index";

afterEach(cleanup);

describe("health check: component status", () => {
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
