// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Resource } from "../types";

const api = vi.hoisted(() => ({
  getResource: vi.fn(),
  updateResource: vi.fn(),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ domain: "open-paas.org", resourceId: "room-2" }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => undefined }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
const userCheck = vi.hoisted(() => ({ status: "idle" }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => userCheck.status }));
vi.mock("../api-client", () => api);
vi.mock("@/hooks/use-managed-domains", () => ({ useManagedDomains: () => new Set(["open-paas.org"]) }));

import CalendarResourceDetail from "./calendar-resource-detail";

const resource: Resource = {
  id: "room-2",
  name: "QA Room 2",
  deleted: false,
  description: "Big meeting room",
  icon: "projector",
  domain: "open-paas.org",
  creator: "alice@open-paas.org",
  administrators: [],
};

beforeEach(() => {
  userCheck.status = "idle";
  api.updateResource.mockReset().mockResolvedValue(undefined);
  api.getResource.mockReset();
  api.getResource.mockResolvedValue(resource);
});

afterEach(cleanup);

describe("CalendarResourceDetail", () => {
  it("adds an administrator from a modal opened by the + next to the Administrators heading", async () => {
    userCheck.status = "exists";
    render(<CalendarResourceDetail />);

    await screen.findByText("domains.calendarResources.administratorsLabel");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByTitle("domains.calendarResources.addAdminTooltip"));
    const dialog = await screen.findByRole("dialog", { name: "domains.calendarResources.addAdminTooltip" });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "domains.calendarResources.addAdminTooltip" }), { target: { value: "bob@open-paas.org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));

    await waitFor(() => expect(api.updateResource).toHaveBeenCalledWith("open-paas.org", "room-2", { administrators: [{ email: "bob@open-paas.org" }] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the administrator modal open with the typed address and shows the refusal in it", async () => {
    userCheck.status = "exists";
    api.updateResource.mockRejectedValue(new Error("Forbidden"));
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByTitle("domains.calendarResources.addAdminTooltip"));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("combobox", { name: "domains.calendarResources.addAdminTooltip" });
    fireEvent.change(input, { target: { value: "bob@open-paas.org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.add" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Forbidden");
    expect(input).toHaveProperty("value", "bob@open-paas.org");
  });

  it("keeps an icon the console does not list when only the name is edited", async () => {
    api.getResource.mockResolvedValue({ ...resource, icon: "space-shuttle" });
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: "QA Room renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateResource).toHaveBeenCalledWith("open-paas.org", "room-2", {
      name: "QA Room renamed", description: "Big meeting room",
    }));
  });

  it("sends the icon once another one is picked", async () => {
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));
    fireEvent.click(screen.getByRole("button", { expanded: false, name: /projector/ }));
    fireEvent.click(screen.getByRole("button", { name: "resourceIcons.meeting-room" }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateResource).toHaveBeenCalledWith("open-paas.org", "room-2", expect.objectContaining({ icon: "meeting-room" })));
  });

  it("ties the Name and Description fields of the edit form to their labels", async () => {
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));

    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" })).toHaveProperty("value", "QA Room 2");
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldDescription" })).toHaveProperty("value", "Big meeting room");
  });

  it("leaves the name out of the update when it is not changed", async () => {
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldDescription" }), { target: { value: "Small room" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateResource).toHaveBeenCalledWith("open-paas.org", "room-2", { description: "Small room" }));
  });

  it("sends the name trimmed", async () => {
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: "  QA Room 3  " } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateResource).toHaveBeenCalledWith("open-paas.org", "room-2", expect.objectContaining({ name: "QA Room 3" })));
  });

  it.each(["", "   "])("does not save the blank name %j", async (blank) => {
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: blank } });
    const save = screen.getByRole("button", { name: "common.save" }) as HTMLButtonElement;
    fireEvent.click(save);

    expect(save.disabled).toBe(true);
    expect(api.updateResource).not.toHaveBeenCalled();
  });

  it("keeps the edit form with the typed values when the update is refused", async () => {
    api.updateResource.mockRejectedValue(new Error("Unsupported icon"));
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));
    fireEvent.change(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" }), { target: { value: "QA Room renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(api.updateResource).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole("button", { name: "common.save" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName *" })).toHaveProperty("value", "QA Room renamed");
  });
});
