// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
});
