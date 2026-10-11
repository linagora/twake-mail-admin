// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ChannelGrid from "./channel-grid";

afterEach(cleanup);

describe("channel grid: field labels", () => {
  it("names the sort select after its visible label", () => {
    render(<ChannelGrid channels={[]} />);

    expect(screen.getByLabelText("networkChannels.sortBy").tagName).toBe("SELECT");
  });
});
