// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Header from "./header";

function renderHeader(enableBackBtn: boolean) {
  render(
    <MemoryRouter>
      <Header headerTitle="Title" docuUrl="https://example.com" enableBackBtn={enableBackBtn} />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("header", () => {
  it("gives the back button an accessible name and a tooltip", () => {
    renderHeader(true);
    const back = screen.getByRole("button", { name: "common.back" });
    expect(back.getAttribute("title")).toBe("common.back");
  });

  it("renders no back button when disabled", () => {
    renderHeader(false);
    expect(screen.queryByRole("button")).toBeNull();
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
