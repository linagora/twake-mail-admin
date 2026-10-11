// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PagedUsersList } from "./paged-users-list";
import { UsernamesSource } from "./users-paging";

const sourceOf = (usernames: string[]): UsernamesSource => async () => usernames;

const failingSource: UsernamesSource = async () => {
  throw new Error("boom");
};

function renderList(source: UsernamesSource, domainChoices: string[] = []) {
  render(
    <MemoryRouter>
      <PagedUsersList source={source} domainChoices={domainChoices} />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("paged users list: empty state", () => {
  it("lists the users without an empty-state message", async () => {
    renderList(sourceOf(["bob@linagora.com"]));
    expect(await screen.findByText("bob@linagora.com")).not.toBeNull();
    expect(screen.queryByText("users.empty")).toBeNull();
  });

  it("tells when there is no user at all", async () => {
    renderList(sourceOf([]));
    expect(await screen.findByText("users.empty")).not.toBeNull();
  });

  it("tells when the selected domain has no user", async () => {
    renderList(sourceOf(["bob@linagora.com"]), ["linagora.com", "localhost"]);
    await screen.findByText("bob@linagora.com");
    fireEvent.change(screen.getByLabelText("common.domain"), { target: { value: "localhost" } });
    expect(await screen.findByText("users.empty")).not.toBeNull();
    expect(screen.queryByText("bob@linagora.com")).toBeNull();
  });

  it("tells when no username starts with the searched prefix", async () => {
    renderList(sourceOf(["bob@linagora.com"]));
    await screen.findByText("bob@linagora.com");
    fireEvent.change(screen.getByPlaceholderText("users.searchPlaceholder"), { target: { value: "zzz" } });
    expect(await screen.findByText("users.noMatch")).not.toBeNull();
  });

  it("shows the error rather than an empty-state message when listing fails", async () => {
    renderList(failingSource);
    expect(await screen.findByText("common.errorPrefix")).not.toBeNull();
    expect(screen.queryByText("users.empty")).toBeNull();
  });
});

describe("paged users list: domain filter", () => {
  it("offers the domain choices in alphabetical order after all domains", () => {
    renderList(sourceOf([]), ["example.org", "qa-imp1.test", "localhost", "qa-imp2.test", "example.com", "qa-wipe.test"]);

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

describe("paged users list: paging reset on filter change", () => {
  const manyUsers = Array.from({ length: 60 }, (_, i) => `user${String(i).padStart(2, "0")}@example.com`);

  async function openSecondPage() {
    await screen.findByText("user00@example.com");
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    await screen.findByText("user50@example.com");
  }

  async function expectFirstPage() {
    expect(await screen.findByText("user00@example.com")).not.toBeNull();
    expect(screen.queryByText("user50@example.com")).toBeNull();
    expect((screen.getByRole("button", { name: "common.previous" }) as HTMLButtonElement).disabled).toBe(true);
  }

  it("restarts from the first page when the search is cleared", async () => {
    renderList(sourceOf(manyUsers));
    await openSecondPage();

    const search = screen.getByPlaceholderText("users.searchPlaceholder");
    fireEvent.change(search, { target: { value: "user5" } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "common.previous" })).toBeNull());
    fireEvent.change(search, { target: { value: "" } });

    await expectFirstPage();
  });

  it("restarts from the first page when all domains are selected again", async () => {
    renderList(sourceOf([...manyUsers, "zed@example.org"]), ["example.com", "example.org"]);
    await openSecondPage();

    const domainSelect = screen.getByLabelText("common.domain");
    fireEvent.change(domainSelect, { target: { value: "example.org" } });
    await screen.findByText("zed@example.org");
    fireEvent.change(domainSelect, { target: { value: "" } });

    await expectFirstPage();
  });
});
