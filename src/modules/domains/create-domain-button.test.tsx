// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const config = vi.hoisted(() => ({ appConfig: { application: "MAIL" } }));
vi.mock("@/lib/config", () => config);
vi.mock("./api-client", () => ({ createDomain: vi.fn() }));

import CreateDomainButton from "./create-domain-button";

afterEach(cleanup);

describe("Create a domain", () => {
  it.each([
    ["MAIL", "domains.createHint"],
    ["CALENDAR", "domains.createHintCalendar"],
  ])("explains what the domain is for on the %s server", (application, hint) => {
    config.appConfig.application = application;
    render(<CreateDomainButton onCreated={() => {}} />);

    fireEvent.click(screen.getByText("domains.createButton"));

    expect(screen.getByText(hint)).not.toBeNull();
  });

  it("reopens empty after being closed without creating", () => {
    render(<CreateDomainButton onCreated={() => {}} />);
    fireEvent.click(screen.getByText("domains.createButton"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "qa-x.test" } });
    fireEvent.click(screen.getByText("common.cancel"));

    fireEvent.click(screen.getByText("domains.createButton"));

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
});
