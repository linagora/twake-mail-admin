// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const confirm = vi.fn(async () => false);
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => confirm }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock("./api-client", () => ({
  getDomains: vi.fn(async () => ["example.com", "example.org"]),
  createDomain: vi.fn(),
  deleteDomain: vi.fn(),
}));

import DomainsList from "./domains-list";

async function renderList() {
  render(
    <MemoryRouter>
      <DomainsList />
    </MemoryRouter>
  );
  await screen.findByText("example.com");
}

function search(query: string) {
  fireEvent.change(screen.getByPlaceholderText("domains.searchPlaceholder"), { target: { value: query } });
}

afterEach(() => {
  cleanup();
  confirm.mockClear();
});

describe("domains list: search", () => {
  it("lists the matching domains without an empty-state message", async () => {
    await renderList();
    search("ORG");
    expect(screen.getByText("example.org")).not.toBeNull();
    expect(screen.queryByText("example.com")).toBeNull();
    expect(screen.queryByText("domains.noMatch")).toBeNull();
  });

  it("tells when no domain matches the search", async () => {
    await renderList();
    search("zzz");
    expect(screen.getByText("domains.noMatch")).not.toBeNull();
    expect(screen.queryByText("example.com")).toBeNull();
  });

  it("restores the list when the search is cleared", async () => {
    await renderList();
    search("zzz");
    search("");
    expect(screen.getByText("example.com")).not.toBeNull();
    expect(screen.queryByText("domains.noMatch")).toBeNull();
  });
});

describe("domains list: create with Enter", () => {
  it("asks for confirmation and prevents the default action of the key press", async () => {
    await renderList();
    const input = screen.getByPlaceholderText("domains.newDomainPlaceholder");
    fireEvent.change(input, { target: { value: "qa-create.org" } });

    const notCancelled = fireEvent.keyDown(input, { key: "Enter" });

    expect(notCancelled).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("leaves other keys untouched", async () => {
    await renderList();
    const input = screen.getByPlaceholderText("domains.newDomainPlaceholder");
    fireEvent.change(input, { target: { value: "qa-create.org" } });

    const notCancelled = fireEvent.keyDown(input, { key: "a" });

    expect(notCancelled).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
