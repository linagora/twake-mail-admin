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

  it("lets the value and its remove button wrap together below the selects on a narrow screen", () => {
    render(<RestoreCriteriaBuilder onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    const valueGroup = screen.getByPlaceholderText("users.deletedVault.criteria.valuePlaceholder").parentElement!;
    const row = valueGroup.parentElement!;
    expect(row.classList.contains("flex-wrap")).toBe(true);
    expect(valueGroup.contains(screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" }))).toBe(true);
    expect(valueGroup.contains(screen.getByRole("combobox", { name: "users.deletedVault.criteria.fieldPlaceholder" }))).toBe(false);
  });

  it("removes the criterion when its remove button is clicked", () => {
    render(<RestoreCriteriaBuilder onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    fireEvent.click(screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" }));

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("reports an incomplete criterion as invalid and flags it", () => {
    const onChange = vi.fn();
    render(<RestoreCriteriaBuilder onChange={onChange} />);
    expect(onChange).toHaveBeenLastCalledWith([], undefined, true);

    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    expect(onChange).toHaveBeenLastCalledWith([], undefined, false);
    expect(screen.getByRole("status").textContent).toBe("users.deletedVault.criteria.incomplete");
  });

  it("reports the criteria as valid again once the incomplete criterion is removed", () => {
    const onChange = vi.fn();
    render(<RestoreCriteriaBuilder onChange={onChange} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    fireEvent.click(screen.getByRole("button", { name: "users.deletedVault.criteria.removeCriterion" }));

    expect(onChange).toHaveBeenLastCalledWith([], undefined, true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("flags only the empty controls of an incomplete criterion when asked to", () => {
    const { rerender } = render(<RestoreCriteriaBuilder onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));
    const field = screen.getByRole("combobox", { name: "users.deletedVault.criteria.fieldPlaceholder" });
    expect(field.getAttribute("aria-invalid")).toBe("false");

    rerender(<RestoreCriteriaBuilder onChange={vi.fn()} flagIncomplete />);

    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("combobox", { name: "users.deletedVault.criteria.operatorPlaceholder" }).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByPlaceholderText("users.deletedVault.criteria.valuePlaceholder").getAttribute("aria-invalid")).toBe("true");
  });

  it("leaves the incomplete message to its host when asked to", () => {
    render(<RestoreCriteriaBuilder onChange={vi.fn()} showIncompleteMessage={false} />);
    fireEvent.click(screen.getByText("users.deletedVault.criteria.addCriterion"));

    expect(screen.queryByRole("status")).toBeNull();
  });
});
