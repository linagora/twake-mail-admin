// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DeleteUserDataForm from "./delete-user-data-form";

afterEach(cleanup);

describe("delete user data form", () => {
  it("names the resume step field after its visible label", () => {
    render(<DeleteUserDataForm onChange={() => {}} />);
    expect(screen.getByLabelText("deleteUserDataForm.fromStep").tagName).toBe("INPUT");
  });

  it("keeps the resume step in a closed advanced section", () => {
    render(<DeleteUserDataForm onChange={() => {}} />);
    const details = screen.getByText("deleteUserDataForm.advanced").closest("details")!;
    expect(details.open).toBe(false);
    expect(details.contains(screen.getByLabelText("deleteUserDataForm.fromStep"))).toBe(true);
  });

  it("reports the typed step", () => {
    const steps: string[] = [];
    render(<DeleteUserDataForm onChange={(step) => steps.push(step)} />);
    fireEvent.change(screen.getByLabelText("deleteUserDataForm.fromStep"), { target: { value: "DavCalendarDeletionTaskStep" } });
    expect(steps).toEqual(["DavCalendarDeletionTaskStep"]);
  });

  it("suggests a mail step by default", () => {
    render(<DeleteUserDataForm onChange={() => {}} />);
    expect(screen.getByLabelText("deleteUserDataForm.fromStep").getAttribute("placeholder"))
      .toBe("deleteUserDataForm.fromStepPlaceholder");
  });

  it("suggests the step given by the caller", () => {
    render(
      <DeleteUserDataForm
        onChange={() => {}}
        fromStepPlaceholderKey="deleteUserDataForm.calendarFromStepPlaceholder"
      />,
    );
    expect(screen.getByLabelText("deleteUserDataForm.fromStep").getAttribute("placeholder"))
      .toBe("deleteUserDataForm.calendarFromStepPlaceholder");
  });

  it("describes the resume step field with its help", () => {
    render(<DeleteUserDataForm onChange={() => {}} />);
    const field = screen.getByLabelText("deleteUserDataForm.fromStep");
    expect(document.getElementById(field.getAttribute("aria-describedby")!)?.textContent).toBe("deleteUserDataForm.fromStepHelp");
  });
});
