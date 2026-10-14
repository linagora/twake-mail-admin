// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NetworkChannel } from "../types";
import ChannelGrid from "./channel-grid";

afterEach(cleanup);

describe("channel grid: field labels", () => {
  it("names the sort select after its visible label", () => {
    render(<ChannelGrid channels={[]} />);

    expect(screen.getByLabelText("networkChannels.sortBy").tagName).toBe("SELECT");
  });
});

describe("channel grid: details", () => {
  it("exposes each channel as a keyboard reachable button opening its details", async () => {
    const channel: NetworkChannel = {
      protocol: "IMAP",
      endpoint: "imapserver",
      remoteAddress: "10.0.0.1:4242",
      connectionDate: "2026-10-14T08:00:00Z",
      isActive: true,
      isOpen: true,
      isWritable: true,
      isEncrypted: true,
      username: "bob@example.com",
      protocolSpecificInformation: {},
    };
    render(<ChannelGrid channels={[channel]} />);

    const channelButton = screen.getByRole("button", { name: "bob@example.com" });
    channelButton.focus();
    expect(document.activeElement).toBe(channelButton);

    fireEvent.click(channelButton);

    expect(await screen.findByRole("dialog")).not.toBeNull();
  });
});
