// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { useRepositoryId } from "./use-repository-id";

function Probe() {
  return <output>{useRepositoryId()}</output>;
}

const idAt = (url: string) => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/mail-repositories">
          <Route path="repository/:id" element={<Probe />} />
          <Route path="repository/:id/extended" element={<Probe />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  return screen.getByRole("status").textContent;
};

afterEach(cleanup);

describe("repository path of a repository page", () => {
  it("decodes the link of a repository named with %2F once, not into another repository", () => {
    expect(idAt(`/mail-repositories/repository/${encodeURIComponent("var%2Fmail%2Ferror")}?page=1`)).toBe("var%2Fmail%2Ferror");
  });

  it("reads it on the Extended view too", () => {
    expect(idAt(`/mail-repositories/repository/${encodeURIComponent("var%2Fmail%2Ferror")}/extended`)).toBe("var%2Fmail%2Ferror");
  });

  it("reads a usual path", () => {
    expect(idAt(`/mail-repositories/repository/${encodeURIComponent("var/mail/error")}`)).toBe("var/mail/error");
  });

  it("reads a path with a space", () => {
    expect(idAt(`/mail-repositories/repository/${encodeURIComponent("var/mail/qa space")}/extended`)).toBe("var/mail/qa space");
  });
});
