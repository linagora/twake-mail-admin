// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";
import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from "./toast";

afterEach(cleanup);

describe("toast", () => {
  it("gives the close button an accessible name and a tooltip", () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Rate limits updated</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );
    const close = screen.getByRole("button", { name: "common.close" });
    expect(close.getAttribute("title")).toBe("common.close");
  });

  it("shows the toasts at the bottom of the screen, clear of the phone top bar", () => {
    render(
      <ToastProvider>
        <ToastViewport data-testid="viewport" />
      </ToastProvider>
    );
    const classes = screen.getByTestId("viewport").className.split(" ");
    expect(classes).toContain("bottom-0");
    expect(classes).not.toContain("top-0");
  });

  it("shows the close button on touch screens, which have no hover", () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Task failed</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );
    const close = screen.getByRole("button", { name: "common.close" });
    expect(close.className.split(" ")).toContain("[@media(hover:none)]:opacity-100");
  });

  it("keeps a toast raised while a modal dialog is open readable by screen readers", () => {
    const page = (toastOpen: boolean) => (
      <ToastProvider>
        <Toast open={toastOpen}>
          <ToastTitle>Failed to create the mail repository</ToastTitle>
        </Toast>
        <ToastViewport />
        <Dialog open>
          <DialogContent>
            <DialogTitle>Create mail repository</DialogTitle>
            <DialogDescription>Repository path and protocol</DialogDescription>
          </DialogContent>
        </Dialog>
      </ToastProvider>
    );
    const { rerender } = render(page(false));
    rerender(page(true));

    const toastTitle = screen.getByText("Failed to create the mail repository");
    expect(toastTitle.closest("[aria-hidden='true']")).toBeNull();
  });

  function DialogRaisingToasts({ toasts, keepOpen = false }: { toasts: number; keepOpen?: boolean }) {
    const [open, setOpen] = useState(true);
    return (
      <ToastProvider>
        {Array.from({ length: toasts }, (_, index) => (
          <Toast key={index} open>
            <ToastTitle>{`Copied to clipboard ${index}`}</ToastTitle>
          </Toast>
        ))}
        <ToastViewport />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent onEscapeKeyDown={(event) => keepOpen && event.preventDefault()}>
            <DialogTitle>mail-001</DialogTitle>
            <DialogDescription>Mail as JSON</DialogDescription>
            <button>Copy</button>
          </DialogContent>
        </Dialog>
      </ToastProvider>
    );
  }

  const pressEscapeOn = (element: HTMLElement) => {
    element.focus();
    fireEvent.keyDown(element, { key: "Escape" });
  };

  it("closes the dialog holding the focus on Escape, not the toast it raised", () => {
    render(<DialogRaisingToasts toasts={3} />);

    pressEscapeOn(screen.getByRole("button", { name: "Copy" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Copied to clipboard 2")).toBeTruthy();
  });

  it("lets the dialog keep Escape from closing it while a toast is shown", () => {
    render(<DialogRaisingToasts toasts={1} keepOpen />);

    pressEscapeOn(screen.getByRole("button", { name: "Copy" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Copied to clipboard 0")).toBeTruthy();
  });

  it("closes the sheet holding the focus on Escape, not the toast it raised", () => {
    function SheetRaisingToast() {
      const [open, setOpen] = useState(true);
      return (
        <ToastProvider>
          <Toast open>
            <ToastTitle>Saved</ToastTitle>
          </Toast>
          <ToastViewport />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Navigation</SheetDescription>
              <button>Domains</button>
            </SheetContent>
          </Sheet>
        </ToastProvider>
      );
    }
    render(<SheetRaisingToast />);

    pressEscapeOn(screen.getByRole("button", { name: "Domains" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("still closes a toast on Escape when no dialog holds the focus", () => {
    const onOpenChange = vi.fn();
    render(
      <ToastProvider>
        <Toast open onOpenChange={onOpenChange}>
          <ToastTitle>Rate limits updated</ToastTitle>
        </Toast>
        <ToastViewport />
        <button>Elsewhere</button>
      </ToastProvider>
    );

    pressEscapeOn(screen.getByRole("button", { name: "Elsewhere" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
