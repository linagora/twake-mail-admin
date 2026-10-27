// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import SyncSpacesForm from "./sync-spaces-form";
import { EVERY_SPACE } from "./space";

const SPACE = "11111111-1111-1111-1111-111111111111";

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const organization = () => field("twakeSpace.organizationIdOptional");
const space = () => field("twakeSpace.spaceIdOptional");

afterEach(cleanup);

describe("sync spaces form", () => {
  it("enables the space ID only within an organization", () => {
    render(<SyncSpacesForm initialValues={EVERY_SPACE} onChange={vi.fn()} />);
    expect(space().disabled).toBe(true);

    fireEvent.change(organization(), { target: { value: "org-1" } });

    expect(space().disabled).toBe(false);
  });

  it("drops the space ID when the organization is emptied", () => {
    const onChange = vi.fn();
    render(<SyncSpacesForm initialValues={{ organizationId: "org-1", spaceId: SPACE }} onChange={onChange} />);
    expect(onChange).toHaveBeenLastCalledWith({ organizationId: "org-1", spaceId: SPACE });

    fireEvent.change(organization(), { target: { value: "" } });

    expect(onChange).toHaveBeenLastCalledWith({ organizationId: "", spaceId: "" });
    expect(space().value).toBe("");
  });

  it("says in place that the space ID is not a UUID", () => {
    render(<SyncSpacesForm initialValues={{ organizationId: "org-1", spaceId: "" }} onChange={vi.fn()} />);

    fireEvent.change(space(), { target: { value: "sales" } });

    expect(screen.getByText("twakeSpace.invalidSpaceId")).not.toBeNull();
  });
});
