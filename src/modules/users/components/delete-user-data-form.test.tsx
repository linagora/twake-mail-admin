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
});
