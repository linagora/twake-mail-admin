// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("./api-client", () => ({ createDomain: vi.fn(), getDomains: vi.fn() }));

import ImportDomainsButton from "./import-domains-button";

function helpButton() {
  render(<ImportDomainsButton onImported={() => {}} />);
  return screen.getByRole("button", { name: "domains.import.help" });
}

afterEach(cleanup);

describe("import domains help", () => {
  it("is a focusable button", () => {
    const help = helpButton();

    expect(help.tagName).toBe("BUTTON");
    expect(help.getAttribute("type")).toBe("button");
    expect(help.tabIndex).toBe(0);
  });

  it("shows the file format when focused with the keyboard", () => {
    const help = helpButton();

    fireEvent.focus(help);

    expect(screen.getAllByText("domains.import.help").length).toBeGreaterThan(0);
  });

  it("shows the file format when tapped", () => {
    const help = helpButton();

    fireEvent.click(help);

    expect(screen.getAllByText("domains.import.help").length).toBeGreaterThan(0);
  });

  it("does not show the file format until asked", () => {
    helpButton();

    expect(screen.queryAllByText("domains.import.help")).toHaveLength(0);
  });
});
