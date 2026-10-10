// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RestoreCriteriaBuilder from "./restore-criteria-builder";

afterEach(cleanup);

describe("restore criteria builder", () => {
  it("labels the field and operator comboboxes and the remove button of a criterion", () => {
    render(<RestoreCriteriaBuilder onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    expect(screen.getByRole("combobox", { name: "users.deletedVault.criteria.fieldPlaceholder" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "users.deletedVault.criteria.operatorPlaceholder" })).not.toBeNull();
    const remove = screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" });
    expect(remove.getAttribute("title")).toBe("users.deletedVault.criteria.removeCriterion");
  });

  it("removes the criterion when its remove button is clicked", () => {
    render(<RestoreCriteriaBuilder onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    fireEvent.click(screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" }));

    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
