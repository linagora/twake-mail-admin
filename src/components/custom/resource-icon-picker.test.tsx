// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key.replace("resourceIcons.", "") }),
}));

import ResourceIconPicker from "./resource-icon-picker";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

afterEach(cleanup);

const renderPicker = (onChange = vi.fn()) =>
  render(
    <>
      <span id="icon-label">Icon</span>
      <ResourceIconPicker value="home" onChange={onChange} labelId="icon-label" />
    </>
  );

describe("ResourceIconPicker", () => {
  it("names the trigger after its label and the current icon, once", () => {
    renderPicker();

    const trigger = screen.getByRole("button", { name: "Icon home" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("true");
  });

  it("names each icon once and marks the current one as pressed", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Icon home" }));

    expect(screen.getByRole("button", { name: "Icon home" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "projector" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "home", pressed: true })).toBeTruthy();
  });

  it("closes on Escape and gives the focus back to the trigger", () => {
    renderPicker();
    const trigger = screen.getByRole("button", { name: "Icon home" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("button", { name: "projector" }), { key: "Escape" });

    expect(screen.queryByRole("button", { name: "projector" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("selects an icon", () => {
    const onChange = vi.fn();
    renderPicker(onChange);
    fireEvent.click(screen.getByRole("button", { name: "Icon home" }));
    fireEvent.click(screen.getByRole("button", { name: "projector" }));

    expect(onChange).toHaveBeenCalledWith("projector");
  });

  it("inside a dialog, closes only the list on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>New</DialogTitle>
          <ResourceIconPicker value="home" onChange={vi.fn()} />
        </DialogContent>
      </Dialog>
    );
    fireEvent.click(screen.getByRole("button", { name: "home" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "projector" }), { key: "Escape" });

    expect(screen.queryByRole("button", { name: "projector" })).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
