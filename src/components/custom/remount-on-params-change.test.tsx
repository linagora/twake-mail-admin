// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import RemountOnParamsChange from "./remount-on-params-change";

function StatefulPage() {
  const { username } = useParams();
  // The initial value is only computed on mount: it reveals whether the page was remounted.
  const [mountedFor] = useState(username);
  return <p>{`${username} mounted for ${mountedFor}`}</p>;
}

function renderAt(username: string) {
  const router = createMemoryRouter(
    [{ path: "/users/user/:username", element: <RemountOnParamsChange><StatefulPage /></RemountOnParamsChange> }],
    { initialEntries: [`/users/user/${username}`] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(cleanup);

describe("RemountOnParamsChange", () => {
  it("remounts its children when a route parameter changes", async () => {
    const router = renderAt("bob");
    expect(screen.getByText("bob mounted for bob")).toBeTruthy();

    await act(() => router.navigate("/users/user/charlotte"));

    expect(screen.getByText("charlotte mounted for charlotte")).toBeTruthy();
  });
});
