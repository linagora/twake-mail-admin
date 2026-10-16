// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Resource } from "../types";

const api = vi.hoisted(() => ({
  getResource: vi.fn(),
  updateResource: vi.fn(),
}));

vi.mock("react-router", () => ({ useParams: () => ({ domain: "open-paas.org", resourceId: "room-2" }) }));
vi.mock("@/modules/domain-admin/domain-context", () => ({ useDomain: () => undefined }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
vi.mock("../api-client", () => api);

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
  api.getResource.mockReset();
  api.getResource.mockResolvedValue(resource);
});

afterEach(cleanup);

describe("CalendarResourceDetail", () => {
  it("ties the administrator field to the Administrators heading", async () => {
    render(<CalendarResourceDetail />);

    expect(await screen.findByRole("textbox", { name: "domains.calendarResources.administratorsLabel" })).toBeTruthy();
  });

  it("ties the Name and Description fields of the edit form to their labels", async () => {
    render(<CalendarResourceDetail />);

    fireEvent.click(await screen.findByText("common.edit"));

    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldName" })).toHaveProperty("value", "QA Room 2");
    expect(screen.getByRole("textbox", { name: "domains.calendarResources.fieldDescription" })).toHaveProperty("value", "Big meeting room");
  });
});
