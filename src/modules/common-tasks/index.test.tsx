// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProxyResolver, type HttpVerb, type ProxyRule } from "@/lib/proxy-resolver";

const proxy = vi.hoisted(() => ({ resolver: null as { isAllowed: (verb: never, pattern: string) => boolean } | null }));

vi.mock("@/lib/proxy-resolver-context", () => ({
  useIsAllowed: (verb: HttpVerb, pattern: string) => proxy.resolver!.isAllowed(verb as never, pattern),
}));
vi.mock("@/lib/config", () => ({ appConfig: { application: "MAIL", mode: "GLOBAL", sso: null } }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => false }));
vi.mock("./api-client", () => ({}));

import CommonTasks from "./index";

function renderWith(rules: ProxyRule[]) {
  proxy.resolver = new ProxyResolver(rules);
  render(
    <MemoryRouter>
      <CommonTasks />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("common tasks: platform-wide cleanup gates", () => {
  it("shows both cleanup buttons with /messages", () => {
    renderWith([{ verb: ["DELETE"], endpoint: "/messages" }]);
    expect(screen.queryByText("commonTasks.cleanupTrashAll")).not.toBeNull();
    expect(screen.queryByText("commonTasks.cleanupSpamAll")).not.toBeNull();
  });

  it("hides them with the user-scoped rule, which does not cover a call without user", () => {
    renderWith([{ endpoint: "/messages?user=%@{domain}" }]);
    expect(screen.queryByText("commonTasks.cleanupTrashAll")).toBeNull();
    expect(screen.queryByText("commonTasks.cleanupSpamAll")).toBeNull();
  });
});
