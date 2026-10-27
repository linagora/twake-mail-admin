// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import MessageCounts from "./message-counts";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

describe("message counts", () => {
  it("names each counter in visible text, not only in a hover tooltip", async () => {
    await i18n.changeLanguage("en");
    const { container } = render(<MessageCounts total={12} unseen={3} loading={false} />);
    expect(screen.getByText("Total: 12")).toBeTruthy();
    expect(screen.getByText("Unseen: 3")).toBeTruthy();
    expect(container.querySelector("[title]")).toBeNull();
  });

  it("lets the locale place the colon", async () => {
    await i18n.changeLanguage("fr");
    render(<MessageCounts total={2} unseen={0} loading={false} />);
    expect(screen.getByText("Total : 2")).toBeTruthy();
    expect(screen.getByText("Non lus : 0")).toBeTruthy();
  });

  it("shows a dash for a count that failed to load", async () => {
    await i18n.changeLanguage("en");
    render(<MessageCounts total={null} unseen={null} loading={false} />);
    expect(screen.getByText("Total: -")).toBeTruthy();
    expect(screen.getByText("Unseen: -")).toBeTruthy();
  });

  it("shows a placeholder while loading", () => {
    render(<MessageCounts loading />);
    expect(screen.getByText("...")).toBeTruthy();
  });
});
