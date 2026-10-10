// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PagedUsersList } from "./paged-users-list";

const emptySource = () => Promise.resolve([]);

afterEach(cleanup);

describe("paged users list", () => {
  it("offers the domain choices in alphabetical order after all domains", () => {
    render(
      <MemoryRouter>
        <PagedUsersList
          source={emptySource}
          domainChoices={["example.org", "qa-imp1.test", "localhost", "qa-imp2.test", "example.com", "qa-wipe.test"]}
        />
      </MemoryRouter>
    );

    const options = within(screen.getByRole("combobox", { name: "common.domain" }))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "users.allDomains",
      "example.com",
      "example.org",
      "localhost",
      "qa-imp1.test",
      "qa-imp2.test",
      "qa-wipe.test",
    ]);
  });
});
