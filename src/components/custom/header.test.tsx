// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Header from "./header";

afterEach(cleanup);

describe("header", () => {
  it("names the back button", () => {
    render(
      <MemoryRouter>
        <Header headerTitle="Title" docuUrl="https://example.com" enableBackBtn />
      </MemoryRouter>
    );

    const back = screen.getByRole("button", { name: "common.back" });

    expect(back.getAttribute("title")).toBe("common.back");
  });
});
