// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
