// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RATE_LIMIT_KEYS, RateLimits, normalizeRateLimits } from "./rate-limits";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import RateLimitsSection from "./rate-limits-section";

afterEach(() => {
  cleanup();
  toast.mockReset();
});

describe("rate limits section: field labels", () => {
  it("names every field after its visible label", async () => {
    render(
      <RateLimitsSection
        fetchRateLimits={async () => normalizeRateLimits(null)}
        updateRateLimits={async () => {}}
        defaultOpen
      />
    );

    for (const key of RATE_LIMIT_KEYS) {
      const field = await screen.findByLabelText(`rateLimits.${key}`);
      expect(field.tagName).toBe("INPUT");
    }
  });

  it("gives each section its own ids so that two sections on a page do not collide", async () => {
    const props = { fetchRateLimits: async () => normalizeRateLimits(null), updateRateLimits: async () => {}, defaultOpen: true };
    render(
      <>
        <RateLimitsSection {...props} />
        <RateLimitsSection {...props} />
      </>
    );

    const fields = await screen.findAllByLabelText(`rateLimits.${RATE_LIMIT_KEYS[0]}`);
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });
});

describe("rate limits section: validation", () => {
  const renderSection = (updateRateLimits = vi.fn<(limits: Partial<RateLimits>) => Promise<void>>(async () => {})) => {
    render(
      <RateLimitsSection
        fetchRateLimits={async () => normalizeRateLimits(null)}
        updateRateLimits={updateRateLimits}
        defaultOpen
      />
    );
    return updateRateLimits;
  };

  const typeLimit = async (value: string, badInput = false) => {
    const field = await screen.findByLabelText("rateLimits.mailsSentPerMinute");
    Object.defineProperty(field, "validity", { configurable: true, value: { badInput } });
    fireEvent.input(field, { target: { value } });
    return field;
  };

  const saveButton = () => screen.getByRole("button", { name: "common.save" });

  it.each(["-5", "1.5"])("refuses %j on the field and disables save", async (value) => {
    const update = renderSection();

    const field = await typeLimit(value);

    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("rateLimits.invalidDesc");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses text the number input cannot parse instead of saving it as no limit", async () => {
    const update = renderSection();

    const field = await typeLimit("", true);

    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["-1", -1],
    ["0", 0],
    ["10", 10],
  ])("accepts %j and sends it as a JSON integer", async (value, expected) => {
    const update = renderSection();

    const field = await typeLimit(value);
    expect(field.getAttribute("aria-invalid")).toBe("false");
    fireEvent.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const sent = update.mock.calls[0][0];
    expect(sent.mailsSentPerMinute).toBe(expected);
    expect(JSON.stringify(sent)).toContain(`"mailsSentPerMinute":${expected}`);
  });

  it("keeps the typed values and reports the error when the server answers 400", async () => {
    const update = renderSection(vi.fn<(limits: Partial<RateLimits>) => Promise<void>>(async () => Promise.reject(new Error("Invalid limit value"))));

    const field = await typeLimit("10");
    fireEvent.click(saveButton());

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "rateLimits.errorUpdating" })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "rateLimits.updated" }));
    expect((field as HTMLInputElement).value).toBe("10");
    expect(update).toHaveBeenCalledTimes(1);
  });
});
