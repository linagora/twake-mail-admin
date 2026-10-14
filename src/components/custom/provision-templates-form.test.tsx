// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));

import ProvisionTemplatesForm from "./provision-templates-form";

afterEach(cleanup);

describe("provision templates form: field labels", () => {
  it.each([
    "provisionTemplates.sourceUser",
    "provisionTemplates.folderName",
    "provisionTemplates.usersPerSecond",
  ])("names the %s field after its visible label", (label) => {
    render(<ProvisionTemplatesForm showUsersPerSecond onChange={() => {}} />);

    expect(screen.getByLabelText(label).tagName).toBe("INPUT");
  });
});
