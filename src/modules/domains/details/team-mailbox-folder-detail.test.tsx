// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const api = vi.hoisted(() => ({
  getTeamMailboxFolderSubaddressing: vi.fn(),
  setTeamMailboxFolderSubaddressing: vi.fn(),
}));
const proxy = vi.hoisted(() => ({ allowed: true }));

vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => proxy.allowed }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../api-client", () => api);
vi.mock("./team-mailbox-folder-extra-acl", () => ({ default: () => null }));

import TeamMailboxFolderDetail from "./team-mailbox-folder-detail";

function renderFolder() {
  render(
    <MemoryRouter initialEntries={["/domains/domain/example.com/team-mailbox/sales/folder/INBOX"]}>
      <Routes>
        <Route path="/domains/domain/:domain/team-mailbox/:mailbox/folder/:folder" element={<TeamMailboxFolderDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  proxy.allowed = true;
  api.setTeamMailboxFolderSubaddressing.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("team mailbox folder: sub-addressing switch", () => {
  it("exposes the toggle as a switch named after its label, with its state", async () => {
    api.getTeamMailboxFolderSubaddressing.mockResolvedValueOnce({ enabled: false }).mockResolvedValue({ enabled: true });
    renderFolder();

    const toggle = await screen.findByRole("switch", { name: "domains.folders.subaddressing" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("aria-describedby")).toBeTruthy();

    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true"));
    expect(api.setTeamMailboxFolderSubaddressing).toHaveBeenCalledWith("example.com", "sales", "INBOX", true);
  });

  it("keeps the focus on the switch after a change, so that it can be toggled back", async () => {
    api.getTeamMailboxFolderSubaddressing
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValue({ enabled: false });
    renderFolder();

    const toggle = await screen.findByRole("switch");
    toggle.focus();
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByRole("switch")).toBe(toggle);
    expect(document.activeElement).toBe(toggle);

    fireEvent.click(document.activeElement!);

    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    expect(api.setTeamMailboxFolderSubaddressing).toHaveBeenLastCalledWith("example.com", "sales", "INBOX", false);
    expect(document.activeElement).toBe(toggle);
  });

  it("disables the switch when the toggle is not allowed", async () => {
    proxy.allowed = false;
    api.getTeamMailboxFolderSubaddressing.mockResolvedValue({ enabled: true });
    renderFolder();

    const toggle = (await screen.findByRole("switch")) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });
});
