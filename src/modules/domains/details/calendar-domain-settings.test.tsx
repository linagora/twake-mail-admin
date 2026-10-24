// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import CalendarDomainSettings, { SettingRow } from "./calendar-domain-settings";

afterEach(cleanup);

describe("calendar domain settings: field labels", () => {
  it("names each setting select after its visible label", () => {
    render(
      <>
        <SettingRow label="User search mode" defaultLabel="Use system default" value="__default__" options={[]} disabled={false} onChange={() => {}} />
        <SettingRow label="Resource search" defaultLabel="Use system default" value="__default__" options={[]} disabled={false} onChange={() => {}} />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "User search mode" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Resource search" })).toBeTruthy();
  });
});

const api = vi.hoisted(() => ({ getDomainSettings: vi.fn(), updateDomainSettings: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => api);

describe("calendar domain settings: defaults and help", () => {
  it("gives the value of the system default on each unset setting, and says what each one changes", async () => {
    api.getDomainSettings.mockResolvedValue({
      userSearchMode: null,
      resourceSearchEnabled: false,
      defaultCalendarPublicVisibility: null,
      calendarPublicVisibilitySettingEnabled: null,
      resolved: { userSearchMode: "enabled", resourceSearchEnabled: false, defaultCalendarPublicVisibility: "private", calendarPublicVisibilitySettingEnabled: true },
    });
    render(<CalendarDomainSettings domain="open-paas.org" defaultOpen />);

    const userSearch = await screen.findByRole("combobox", { name: "domains.domainSettings.userSearchMode" });
    expect(userSearch.textContent).toBe('domains.domainSettings.useDefaultWithValue {"value":"domains.domainSettings.userSearchModeOptions.enabled"}');
    expect(document.getElementById(userSearch.getAttribute("aria-describedby")!)!.textContent).toBe("domains.domainSettings.hints.userSearchMode");
    // A stored value: what the system default would be is not known
    expect(screen.getByRole("combobox", { name: "domains.domainSettings.resourceSearchEnabled" }).textContent).toBe("domains.domainSettings.booleanOptions.false");
    expect(screen.queryByText("domains.domainSettings.notSaved")).toBeNull();
  });
});
