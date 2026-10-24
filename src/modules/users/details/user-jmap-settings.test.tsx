// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({ getUserJmapSettings: vi.fn(), updateUserJmapSettings: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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
