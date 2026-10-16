// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("./api-client", () => ({
  getRegisteredUsers: vi.fn(async () => [
    { id: "1", email: "alice@example.com", firstname: "Alice", lastname: "Smith" },
    { id: "2", email: "bob@example.com", firstname: "Bob", lastname: "Jones" },
  ]),
  createRegisteredUser: vi.fn(),
  updateRegisteredUser: vi.fn(),
  deleteRegisteredUser: vi.fn(),
}));

import RegisteredUsersList from "./registered-users-list";

async function renderList() {
  render(<RegisteredUsersList />);
  await screen.findByText("alice@example.com");
}

function search(query: string) {
  fireEvent.change(screen.getByPlaceholderText("registeredUsers.searchPlaceholder"), { target: { value: query } });
}

afterEach(cleanup);

describe("registered users list: search", () => {
  it("lists the matching users without an empty-state message", async () => {
    await renderList();
    search("BOB");
    expect(screen.getByText("bob@example.com")).not.toBeNull();
    expect(screen.queryByText("alice@example.com")).toBeNull();
    expect(screen.queryByText("registeredUsers.noMatch")).toBeNull();
  });

  it("tells when no registered user matches the search", async () => {
    await renderList();
    search("zzz");
    expect(screen.getByText("registeredUsers.noMatch")).not.toBeNull();
    expect(screen.queryByText("alice@example.com")).toBeNull();
  });

  it("restores the list when the search is cleared", async () => {
    await renderList();
    search("zzz");
    search("");
    expect(screen.getByText("alice@example.com")).not.toBeNull();
    expect(screen.queryByText("registeredUsers.noMatch")).toBeNull();
  });
});
