// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const config = vi.hoisted(() => ({ appConfig: { application: "MAIL" } }));
vi.mock("@/lib/config", () => config);
vi.mock("./api-client", () => ({ createDomain: vi.fn() }));

import CreateDomainButton from "./create-domain-button";
import { createDomain } from "./api-client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Create a domain", () => {
  it.each([
    ["MAIL", "domains.createHint"],
    ["CALENDAR", "domains.createHintCalendar"],
  ])("explains what the domain is for on the %s server", (application, hint) => {
    config.appConfig.application = application;
    render(<CreateDomainButton existingDomains={[]} onCreated={() => {}} />);

    fireEvent.click(screen.getByText("domains.createButton"));

    expect(screen.getByText(hint)).not.toBeNull();
  });

  it("reopens empty after being closed without creating", () => {
    render(<CreateDomainButton existingDomains={[]} onCreated={() => {}} />);
    fireEvent.click(screen.getByText("domains.createButton"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "qa-x.test" } });
    fireEvent.click(screen.getByText("common.cancel"));

    fireEvent.click(screen.getByText("domains.createButton"));

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("says a domain already listed exists, whatever its case, instead of creating it", async () => {
    const onCreated = vi.fn();
    render(<CreateDomainButton existingDomains={["example.com"]} onCreated={onCreated} />);
    fireEvent.click(screen.getByText("domains.createButton"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " Example.COM " } });

    fireEvent.click(screen.getByText("common.create"));

    expect((await screen.findByRole("alert")).textContent).toContain("domains.alreadyExists");
    expect(createDomain).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates a domain not listed yet", async () => {
    const onCreated = vi.fn();
    render(<CreateDomainButton existingDomains={["example.com"]} onCreated={onCreated} />);
    fireEvent.click(screen.getByText("domains.createButton"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "other.com" } });

    fireEvent.click(screen.getByText("common.create"));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createDomain).toHaveBeenCalledWith("other.com");
  });
});
