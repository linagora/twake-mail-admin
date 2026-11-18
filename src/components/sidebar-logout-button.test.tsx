// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";

const config = vi.hoisted(() => ({ appConfig: { sso: null as object | null } }));
const oidc = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("@/lib/config", () => config);
vi.mock("@/components/custom/oidc-provider", () => ({ useOIDC: () => oidc }));

import "@/i18n";
import { AuthProvider } from "@/components/custom/auth-provider";
import { getBearerToken, setBearerToken } from "@/lib/auth";
import { SidebarLogoutButton } from "./sidebar-logout-button";

const reload = vi.fn();

const renderButton = () => render(
  <AuthProvider>
    <SidebarProvider>
      <SidebarMenu>
        <SidebarLogoutButton />
      </SidebarMenu>
    </SidebarProvider>
  </AuthProvider>
);

const logoutButton = () => screen.queryByRole("button", { name: "Logout" });

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  config.appConfig.sso = null;
  reload.mockClear();
  oidc.logout.mockClear();
});

describe("sidebar logout in static-token mode", () => {
  it("is offered once a token is held, forgets it and reloads to prompt for a new one", () => {
    setBearerToken("secret-token");
    renderButton();

    fireEvent.click(logoutButton()!);

    expect(getBearerToken()).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("is not offered when no token is held", () => {
    renderButton();

    expect(logoutButton()).toBeNull();
  });
});

describe("sidebar logout in SSO mode", () => {
  it("ends the OIDC session", () => {
    config.appConfig.sso = {};
    renderButton();

    fireEvent.click(logoutButton()!);

    expect(oidc.logout).toHaveBeenCalledOnce();
  });
});
