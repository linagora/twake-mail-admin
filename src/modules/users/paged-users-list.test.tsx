// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
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

describe("paged users list: search and filter in the URL", () => {
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.search}</output>;
  }

  function renderAt(url: string, source: UsernamesSource, domainChoices: string[] = []) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <PagedUsersList source={source} domainChoices={domainChoices} />
        <LocationProbe />
      </MemoryRouter>
    );
  }

  it("restores the domain filter and the search from the URL", async () => {
    const source: UsernamesSource = async ({ domain, query }) =>
      ["bob@example.com", "oscar@example.org"].filter((u) => (!domain || u.endsWith(`@${domain}`)) && u.startsWith(query ?? ""));
    renderAt("/users?domain=example.org&q=os", source, ["example.com", "example.org"]);

    expect(await screen.findByText("oscar@example.org")).not.toBeNull();
    expect(screen.queryByText("bob@example.com")).toBeNull();
    expect((screen.getByLabelText("common.domain") as HTMLSelectElement).value).toBe("example.org");
    expect((screen.getByPlaceholderText("users.searchPlaceholder") as HTMLInputElement).value).toBe("os");
  });

  it("writes the domain filter and the search into the URL", async () => {
    renderAt("/users", sourceOf(["bob@example.com"]), ["example.com", "example.org"]);
    await screen.findByText("bob@example.com");

    fireEvent.change(screen.getByLabelText("common.domain"), { target: { value: "example.org" } });
    fireEvent.change(screen.getByPlaceholderText("users.searchPlaceholder"), { target: { value: "bo" } });

    expect(screen.getByTestId("location").textContent).toBe("?domain=example.org&q=bo");
  });
});

describe("paged users list: users of a deleted domain", () => {
  it("marks a user whose domain is not managed any more", async () => {
    renderList(sourceOf(["bob@example.com", "ghost@gone.test"]), ["example.com"]);
    await screen.findByText("ghost@gone.test");
    expect(screen.getAllByText("users.unmanagedDomain")).toHaveLength(1);
    expect(screen.getByText("ghost@gone.test").parentElement?.textContent).toContain("users.unmanagedDomain");
  });
});

describe("paged users list: count", () => {
  it("says how many users the only page holds", async () => {
    renderList(sourceOf(["alice@example.com", "bob@example.com"]));
    expect(await screen.findByText("users.countSingle")).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("gives the range of a page when there are several", async () => {
    renderList(sourceOf(Array.from({ length: 60 }, (_, i) => `user${String(i).padStart(2, "0")}@example.com`)));
    expect(await screen.findByText("users.countRange")).not.toBeNull();
  });
});

describe("paged users list: quick successive filter changes", () => {
  it("keeps the cleared search when the domain changes right after", async () => {
    function LocationProbe() {
      const location = useLocation();
      return <output data-testid="location">{location.search}</output>;
    }
    render(
      <MemoryRouter initialEntries={["/users?q=o"]}>
        <PagedUsersList source={sourceOf(["bob@example.com"])} domainChoices={["example.com", "example.org"]} />
        <LocationProbe />
      </MemoryRouter>
    );
    await screen.findByText("users.noMatch");
    act(() => {
      fireEvent.change(screen.getByPlaceholderText("users.searchPlaceholder"), { target: { value: "" } });
      fireEvent.change(screen.getByLabelText("common.domain"), { target: { value: "example.org" } });
    });
    expect(screen.getByTestId("location").textContent).toBe("?domain=example.org");
  });
});

describe("paged users list: search typed in a burst", () => {
  function BackButton() {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>back</button>;
  }

  function renderAt(...entries: string[]) {
    render(
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <PagedUsersList source={sourceOf(["charlotte@example.com"])} />
        <BackButton />
      </MemoryRouter>
    );
  }

  const searchField = () => screen.getByPlaceholderText("users.searchPlaceholder") as HTMLInputElement;

  it("keeps every key typed before the URL catches up", async () => {
    renderAt("/users");
    await screen.findByText("charlotte@example.com");

    act(() => {
      fireEvent.change(searchField(), { target: { value: "c" } });
      expect(searchField().value).toBe("c");
      fireEvent.change(searchField(), { target: { value: "ch" } });
      expect(searchField().value).toBe("ch");
    });

    expect(searchField().value).toBe("ch");
    expect(await screen.findByText("charlotte@example.com")).not.toBeNull();
  });

  it("shows the search of the URL reached by Back", async () => {
    renderAt("/users?q=bo", "/users?q=ch");
    await screen.findByText("charlotte@example.com");

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() => expect(searchField().value).toBe("bo"));
  });
});
