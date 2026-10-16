// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DeleteUserDataForm from "./delete-user-data-form";

afterEach(cleanup);

describe("delete user data form", () => {
  it("names the resume step field after its visible label", () => {
    render(<DeleteUserDataForm username="bob@example.com" onChange={() => {}} />);
    expect(screen.getByLabelText("deleteUserDataForm.fromStep:").tagName).toBe("INPUT");
  });

  it("suggests a mail step by default", () => {
    render(<DeleteUserDataForm username="bob@example.com" onChange={() => {}} />);
    expect(screen.getByLabelText("deleteUserDataForm.fromStep:").getAttribute("placeholder"))
      .toBe("deleteUserDataForm.fromStepPlaceholder");
  });

  it("suggests the step given by the caller", () => {
    render(
      <DeleteUserDataForm
        username="bob@example.com"
        onChange={() => {}}
        fromStepPlaceholderKey="deleteUserDataForm.calendarFromStepPlaceholder"
      />,
    );
    expect(screen.getByLabelText("deleteUserDataForm.fromStep:").getAttribute("placeholder"))
      .toBe("deleteUserDataForm.calendarFromStepPlaceholder");
  });
});
