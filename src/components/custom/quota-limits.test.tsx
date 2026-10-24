// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/test/resize-observer";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import QuotaLimits, { QuotaLimitValues, toSizeField } from "./quota-limits";

const MB = 1024 * 1024;
const api = { putCount: vi.fn(), deleteCount: vi.fn(), putSize: vi.fn(), deleteSize: vi.fn() };
const onChanged = vi.fn();

function renderLimits(current: QuotaLimitValues) {
  render(
    <QuotaLimits
      target="bob@example.com"
      current={current}
      parents={[
        { label: "of the domain", values: { count: null, size: null } },
        { label: "global", values: { count: 5000, size: 1024 * MB } },
      ]}
      api={api}
      canEditCount
      canEditSize
      canRemove
      removeLabel="quotaLimits.removeSpecific"
      removeConfirm="sure?"
      onChanged={onChanged}
    />
  );
}

const openLimits = (current: QuotaLimitValues) => {
  renderLimits(current);
  fireEvent.click(screen.getByRole("button", { name: "quotaLimits.edit" }));
};
const save = () => fireEvent.click(screen.getByRole("button", { name: "common.save" }));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
  onChanged.mockReset();
  toast.mockReset();
});
afterEach(cleanup);

describe("quota limits: size field", () => {
  it("writes a size in the largest unit giving a whole or one-decimal number", () => {
    expect(toSizeField(50 * MB)).toEqual({ value: "50", unit: "MB" });
    expect(toSizeField(2048 * MB)).toEqual({ value: "2", unit: "GB" });
    expect(toSizeField(1536 * MB)).toEqual({ value: "1.5", unit: "GB" });
    expect(toSizeField(1000)).toEqual({ value: "1000", unit: "B" });
  });
});

describe("quota limits: dialog", () => {
  it("opens prefilled with both current limits, and sends only the changed one", async () => {
    openLimits({ count: 1000, size: 50 * MB });

    const count = screen.getByLabelText("quotaLimits.count") as HTMLInputElement;
    expect(count.value).toBe("1000");
    expect((screen.getByLabelText("quotaLimits.size") as HTMLInputElement).value).toBe("50");
    expect((screen.getByLabelText("common.sizeUnit") as HTMLSelectElement).value).toBe("MB");

    fireEvent.change(count, { target: { value: "2000" } });
    save();

    await waitFor(() => expect(api.putCount).toHaveBeenCalledWith(2000));
    expect(api.putSize).not.toHaveBeenCalled();
    expect(api.deleteSize).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("removes a limit whose field is emptied", async () => {
    openLimits({ count: 1000, size: 50 * MB });
    fireEvent.change(screen.getByLabelText("quotaLimits.size"), { target: { value: "" } });
    save();

    await waitFor(() => expect(api.deleteSize).toHaveBeenCalled());
    expect(api.putCount).not.toHaveBeenCalled();
  });

  it.each(["0.4", "1.5", "0"])("refuses the message count %s without sending it", async (value) => {
    openLimits({ count: null, size: null });
    fireEvent.change(screen.getByLabelText("quotaLimits.count"), { target: { value } });
    save();

    expect((await screen.findByRole("alert")).textContent).toBe("quotaLimits.invalidCount");
    expect(api.putCount).not.toHaveBeenCalled();
  });

  it("keeps a fractional size, converted to bytes", async () => {
    openLimits({ count: null, size: null });
    fireEvent.change(screen.getByLabelText("quotaLimits.size"), { target: { value: "1.5" } });
    save();

    await waitFor(() => expect(api.putSize).toHaveBeenCalledWith(1.5 * MB));
  });

  it("states the inherited limits and offers no removal without a specific limit", () => {
    renderLimits({ count: null, size: null });
    expect(screen.queryByRole("button", { name: "quotaLimits.removeSpecific" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "quotaLimits.edit" }));

    expect((screen.getByLabelText("quotaLimits.count") as HTMLInputElement).value).toBe("");
    expect(screen.getAllByText(/quotaLimits.inheritHint .*"parent":"global"/)).toHaveLength(2);
  });

  it("stores -1 when unlimited is ticked", async () => {
    openLimits({ count: null, size: null });
    fireEvent.click(screen.getAllByRole("checkbox", { name: "quotaLimits.unlimited" })[0]);
    save();

    await waitFor(() => expect(api.putCount).toHaveBeenCalledWith(-1));
  });

  it("removes both specific limits", async () => {
    renderLimits({ count: 1000, size: 50 * MB });
    fireEvent.click(screen.getByRole("button", { name: "quotaLimits.removeSpecific" }));

    await waitFor(() => expect(api.deleteSize).toHaveBeenCalled());
    expect(api.deleteCount).toHaveBeenCalled();
  });
});
