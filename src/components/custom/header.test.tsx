// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/lib/config", () => ({ appConfig: { application: "CALENDAR", mode: "GLOBAL", sso: null } }));

import Header from "./header";

afterEach(cleanup);

describe("header", () => {
  it("renders the title as the h1 of the page", () => {
    render(<MemoryRouter><Header headerTitle="Title" docuUrl="" /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Title");
  });

  it("names the browser tab after the title", () => {
    render(<MemoryRouter><Header headerTitle="alice@example.com" /></MemoryRouter>);
    expect(document.title).toBe("alice@example.com — Twake Calendar Admin");
  });

  it("leads back to the parent page with one link holding the chevron and its name", () => {
    render(
      <MemoryRouter>
        <Header headerTitle="sales@example.com" breadcrumb={[{ label: "Domains", to: "/domains" }, { label: "example.com", to: "/domains/domain/example.com" }]} />
      </MemoryRouter>
    );
    const nav = screen.getByRole("navigation", { name: "common.breadcrumb" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["example.com", "/domains/domain/example.com"]]);
    expect(links[0].querySelector("svg")).not.toBeNull();
  });

  it("renders no breadcrumb on a list page", () => {
    render(<MemoryRouter><Header headerTitle="Title" /></MemoryRouter>);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("links the subtitle to the documentation", () => {
    render(
      <MemoryRouter>
        <Header headerTitle="Title" headerSubTitle="Subtitle" docuUrl="https://example.com" />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "doc" }).getAttribute("href")).toBe("https://example.com");
  });

  it("renders no doc link when there is no documentation", () => {
    render(
      <MemoryRouter>
        <Header headerTitle="Title" headerSubTitle="Subtitle" docuUrl="" />
      </MemoryRouter>
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Subtitle")).toBeTruthy();
  });
});

describe("header: sticky bar of a detail page", () => {
  // Lets a test say whether the header has scrolled away
  let report: (past: boolean) => void = () => {};
  class FakeIntersectionObserver {
    constructor(callback: (entries: Array<Partial<IntersectionObserverEntry>>) => void) {
      report = (past) => callback([{ isIntersecting: !past, boundingClientRect: { top: past ? -200 : 10 } as DOMRectReadOnly }]);
    }
    observe() {}
    disconnect() {}
  }

  it("shows the back link, the object and the actions once the header scrolled away", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const { container } = render(
      <MemoryRouter>
        <Header headerTitle="bob@example.com" breadcrumb={[{ label: "Users", to: "/users" }]} actions={<button>Expand all</button>} />
      </MemoryRouter>
    );
    expect(container.querySelector("[data-sticky-header]")).toBeNull();

    await act(async () => report(true));
    const bar = container.querySelector("[data-sticky-header]")!;
    expect(bar.textContent).toContain("Users");
    expect(bar.textContent).toContain("bob@example.com");
    expect(bar.textContent).toContain("Expand all");
    // Shortened on a phone, the object stays readable in full
    expect(bar.querySelector('[title="bob@example.com"]')).not.toBeNull();

    await act(async () => report(false));
    expect(container.querySelector("[data-sticky-header]")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("has no sticky bar on a list page", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    report = () => {};
    const { container } = render(<MemoryRouter><Header headerTitle="Users" /></MemoryRouter>);
    await act(async () => report(true));
    expect(container.querySelector("[data-sticky-header]")).toBeNull();
    vi.unstubAllGlobals();
  });
});
