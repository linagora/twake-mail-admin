// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RenameUserForm from "./rename-user-form";

afterEach(cleanup);

describe("rename user form", () => {
  it("labels the source as the current username, not the new one", () => {
    render(<RenameUserForm username="ren1@example.com" onChange={() => {}} />);
    expect(screen.getByText("ren1@example.com").parentElement?.textContent).toBe(
      "renameUserForm.currentUsername: ren1@example.com"
    );
    expect(screen.getAllByText(/renameUserForm\.newUsername/)).toHaveLength(1);
  });

  it("warns that the target account must already exist", () => {
    render(<RenameUserForm username="ren1@example.com" onChange={() => {}} />);
    expect(screen.queryByText("renameUserForm.targetMustExist")).not.toBeNull();
  });
});
