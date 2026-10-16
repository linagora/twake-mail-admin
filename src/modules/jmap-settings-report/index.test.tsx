// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("./api-client", () => ({ getJmapSettingsReport: vi.fn().mockResolvedValue({}) }));

import JmapSettingsReportPage from "./index";

afterEach(cleanup);

describe("JMAP settings report page", () => {
  it("links its subtitle to the JMAP settings reports documentation", async () => {
    render(
      <MemoryRouter>
        <JmapSettingsReportPage />
      </MemoryRouter>
    );

    const link = await screen.findByRole("link", { name: "doc" });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/linagora/tmail-backend/blob/master/docs/modules/ROOT/pages/tmail-backend/webadmin.adoc#jmap-settings-reports"
    );
  });
});
