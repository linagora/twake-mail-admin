// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
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
});
