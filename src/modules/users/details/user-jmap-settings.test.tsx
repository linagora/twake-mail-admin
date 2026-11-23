// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ getUserJmapSettings: vi.fn(), updateUserJmapSettings: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("../api-client", () => api);

import UserJmapSettings from "./user-jmap-settings";

beforeEach(() => {
  localStorage.clear();
  api.getUserJmapSettings.mockReset().mockResolvedValue({ language: "fr" });
});
afterEach(cleanup);

describe("user JMAP settings", () => {
  it("labels the key and value fields of each row, the placeholder being only an example", async () => {
    render(<UserJmapSettings username="alice@example.com" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const key = await screen.findByRole("textbox", { name: "users.jmapSettings.key" });
    expect((key as HTMLInputElement).value).toBe("language");
    expect((screen.getByRole("textbox", { name: "users.jmapSettings.value" }) as HTMLInputElement).value).toBe("fr");
  });
});

const manySettings = (count: number): Record<string, string> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`key${i}`, "v"]));

// With a thousand rows, role queries take seconds: these look the elements up directly
const inputsNamed = (name: string) => document.querySelectorAll<HTMLInputElement>(`input[aria-label="${name}"]`);
const openSection = async () => {
  render(<UserJmapSettings username="alice@example.com" />);
  fireEvent.click(screen.getByRole("button", { expanded: false }));
  await waitFor(() => expect(inputsNamed("users.jmapSettings.key").length).toBeGreaterThan(0));
};
const buttonWithText = (text: string) => screen.getByText(text).closest("button")!;

describe("user JMAP settings: size limits", () => {
  beforeEach(() => api.updateUserJmapSettings.mockReset().mockResolvedValue(undefined));

  it("refuses to save a 16385-character value, saying why on its row", async () => {
    await openSection();

    fireEvent.change(screen.getByRole("textbox", { name: "users.jmapSettings.value" }), { target: { value: "a".repeat(16385) } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(screen.getByText("users.sizeLimits.tooLong")).not.toBeNull();
    expect(api.updateUserJmapSettings).not.toHaveBeenCalled();
  });

  it("saves a 16384-character value", async () => {
    await openSection();

    fireEvent.change(screen.getByRole("textbox", { name: "users.jmapSettings.value" }), { target: { value: "a".repeat(16384) } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateUserJmapSettings).toHaveBeenCalledWith("alice@example.com", { language: "a".repeat(16384) }));
  });

  it("sends an emptied value as an empty string, never null", async () => {
    await openSection();

    fireEvent.change(screen.getByRole("textbox", { name: "users.jmapSettings.value" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateUserJmapSettings).toHaveBeenCalledWith("alice@example.com", { language: "" }));
  });

  it("counts the settings, and disables adding one at 1000", async () => {
    api.getUserJmapSettings.mockResolvedValue(manySettings(1000));
    await openSection();

    expect(screen.getByTestId("jmap-settings-count").textContent).toBe("1000 / 1000");
    expect(buttonWithText("users.jmapSettings.addRow").disabled).toBe(true);
    expect(screen.queryByText("users.jmapSettings.tooMany")).toBeNull();
  });

  // A thousand rows render slowly when the whole suite runs in parallel
  it("loads 1001 stored settings, saying how many to remove, and saves once one is removed", { timeout: 30_000 }, async () => {
    api.getUserJmapSettings.mockResolvedValue(manySettings(1001));
    await openSection();

    expect(inputsNamed("users.jmapSettings.key")).toHaveLength(1001);
    expect(screen.getByTestId("jmap-settings-count").textContent).toBe("1001 / 1000");
    expect(screen.getByText("users.jmapSettings.tooMany")).not.toBeNull();

    fireEvent.click(document.querySelectorAll('button[title="users.jmapSettings.removeRow"]')[1]);
    expect(screen.queryByText("users.jmapSettings.tooMany")).toBeNull();
    fireEvent.click(buttonWithText("common.save"));
    await waitFor(() => expect(api.updateUserJmapSettings).toHaveBeenCalled());
  });

  it("keeps the edited rows when the server answers 400", async () => {
    api.updateUserJmapSettings.mockRejectedValueOnce(new Error("value too long"));
    await openSection();

    fireEvent.change(screen.getByRole("textbox", { name: "users.jmapSettings.value" }), { target: { value: "en" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateUserJmapSettings).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole("button", { name: "common.save" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole("textbox", { name: "users.jmapSettings.value" }) as HTMLInputElement).value).toBe("en");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "users.jmapSettings.errorSaving" }));
  });
});
