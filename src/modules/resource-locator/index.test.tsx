// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("./api-client", () => ({ lookupMailbox: vi.fn(), lookupMessage: vi.fn() }));

import ResourceLocator from "./index";

function renderLocator() {
  render(
    <MemoryRouter>
      <ResourceLocator />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("resource locator: field labels", () => {
  it.each([
    "resourceLocator.lookupMailboxLabel",
    "resourceLocator.locateMessageLabel",
  ])("names the search field after its %s title", (label) => {
    renderLocator();

    expect(screen.getByRole("textbox", { name: label })).not.toBeNull();
  });

  it("gives each search field its own id", () => {
    renderLocator();

    const [mailboxField, messageField] = screen.getAllByRole("textbox");
    expect(mailboxField.id).not.toBe(messageField.id);
  });
});
