// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExpandCollapseAll, SectionsProvider, SectionToggle, useSectionOpen } from "./collapsible-section";

function Section({ id, defaultOpen, onRender }: { id: string; defaultOpen?: boolean; onRender?: () => void }) {
  const [open, setOpen, contentId] = useSectionOpen(id, defaultOpen);
  return (
    <div>
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={contentId}>{id}</SectionToggle>
      {open && <Content id={contentId} onRender={onRender} />}
    </div>
  );
}

function Content({ id, onRender }: { id: string; onRender?: () => void }) {
  onRender?.();
  return <div id={id}>content</div>;
}

const page = (children: React.ReactNode) => render(<SectionsProvider page="user"><ExpandCollapseAll />{children}</SectionsProvider>);
const toggle = (name: string) => screen.getByRole("button", { name });

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("collapsible sections", () => {
  it("offers Expand all and Collapse all only while the page has sections", () => {
    const { rerender } = page(null);
    expect(screen.queryByText("common.expandAll")).toBeNull();
    expect(screen.queryByText("common.collapseAll")).toBeNull();

    rerender(<SectionsProvider page="user"><ExpandCollapseAll /><Section id="quota-c" /></SectionsProvider>);
    expect(screen.getByText("common.expandAll")).not.toBeNull();

    rerender(<SectionsProvider page="user"><ExpandCollapseAll /></SectionsProvider>);
    expect(screen.queryByText("common.expandAll")).toBeNull();
  });

  it("exposes its state and points to its content, open or closed", () => {
    page(<Section id="calendars-a" />);
    expect(toggle("calendars-a").getAttribute("aria-expanded")).toBe("false");
    const closed = document.getElementById(toggle("calendars-a").getAttribute("aria-controls")!);
    expect(closed?.hidden).toBe(true);

    fireEvent.click(toggle("calendars-a"));

    expect(toggle("calendars-a").getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(toggle("calendars-a").getAttribute("aria-controls")!)?.textContent).toBe("content");
    expect(document.querySelectorAll(`[id="${toggle("calendars-a").getAttribute("aria-controls")}"]`)).toHaveLength(1);
  });

  it("does not render its content, hence fetch, until opened", () => {
    const rendered = vi.fn();
    page(<Section id="resources-b" onRender={rendered} />);
    expect(rendered).not.toHaveBeenCalled();
    fireEvent.click(toggle("resources-b"));
    expect(rendered).toHaveBeenCalled();
  });

  it("remembers its state per page type, across objects and reloads", () => {
    page(<Section id="booking-c" />);
    fireEvent.click(toggle("booking-c"));
    cleanup();

    page(<Section id="booking-c" />);
    expect(toggle("booking-c").getAttribute("aria-expanded")).toBe("true");
    expect(window.localStorage.getItem("section:user:booking-c")).toBe("true");
  });

  it("opens on a first visit when told so", () => {
    page(<Section id="address-books-d" defaultOpen />);
    expect(toggle("address-books-d").getAttribute("aria-expanded")).toBe("true");
  });

  it("expands and collapses every section of the page", () => {
    page(<><Section id="e1" /><Section id="e2" /></>);

    fireEvent.click(screen.getByText("common.expandAll"));
    expect([toggle("e1"), toggle("e2")].map((b) => b.getAttribute("aria-expanded"))).toEqual(["true", "true"]);

    fireEvent.click(screen.getByText("common.collapseAll"));
    expect([toggle("e1"), toggle("e2")].map((b) => b.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
    expect(window.localStorage.getItem("section:user:e1")).toBe("false");
  });

  it("is plain state outside a page", () => {
    render(<Section id="f" />);
    fireEvent.click(toggle("f"));
    expect(toggle("f").getAttribute("aria-expanded")).toBe("true");
    expect(window.localStorage.getItem("section:user:f")).toBeNull();
  });
});
