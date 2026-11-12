// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));

import ProvisionTemplatesForm from "./provision-templates-form";
import { provisionSourceError } from "./provision-source";

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

describe("provision templates form: source user", () => {
  it("requires a source user", () => {
    expect(provisionSourceError("", "a.org", false)).toBe("provisionTemplates.sourceUserRequired");
  });

  it("refuses, for a domain administrator, a source user of another domain", () => {
    expect(provisionSourceError("victim@b.org", "a.org", true)).toBe("provisionTemplates.sourceUserOtherDomain");
  });

  it("accepts, for a domain administrator, a source user of the administered domain", () => {
    expect(provisionSourceError("ref@A.org", "a.org", true)).toBeNull();
  });

  it("lets a platform operator provision from any user", () => {
    expect(provisionSourceError("ref@b.org", "a.org", false)).toBeNull();
  });
});
