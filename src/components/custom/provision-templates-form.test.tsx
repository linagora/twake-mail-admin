// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";

vi.mock("@/hooks/use-check-user-exists", () => ({ useCheckUserExists: () => "idle" }));
const appearance = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("@/components/custom/confirm-provider", () => ({ useConfirmAppearance: () => appearance.set }));

import ProvisionTemplatesForm from "./provision-templates-form";
import { provisionFolderError, provisionSourceError, provisionSourceInlineError, provisionValuesError } from "./provision-source";
import { describeProvisionRefusal, refusedProvisionParam } from "./provision-refusal";

afterEach(() => {
  cleanup();
  appearance.set.mockClear();
});

const renderForm = () => render(<ProvisionTemplatesForm domain="a.org" showUsersPerSecond onChange={() => {}} />);

describe("provision templates form: field labels", () => {
  it.each([
    "provisionTemplates.sourceUser",
    "provisionTemplates.folderName",
    "provisionTemplates.usersPerSecond",
  ])("names the %s field after its visible label", (label) => {
    renderForm();

    expect(screen.getByLabelText(label).tagName).toBe("INPUT");
  });
});

describe("provision templates form: source user", () => {
  it("requires a source user", () => {
    expect(provisionSourceError("", "a.org")).toBe("provisionTemplates.sourceUserRequired");
  });

  it("refuses a source user of another domain, whoever runs it", () => {
    expect(provisionSourceError("victim@b.org", "a.org")).toBe("provisionTemplates.sourceUserOtherDomain");
  });

  it("accepts a source user of the target domain, whatever its case", () => {
    expect(provisionSourceError("ref@A.org", "a.org")).toBeNull();
  });

  it("flags the field only once a domain is typed", () => {
    expect(provisionSourceInlineError("", "a.org")).toBeNull();
    expect(provisionSourceInlineError("ref", "a.org")).toBeNull();
    expect(provisionSourceInlineError(" victim@b.org ", "a.org")).toBe("provisionTemplates.sourceUserOtherDomain");
    expect(provisionSourceInlineError(" ref@a.org ", "a.org")).toBeNull();
  });
});

describe("provision templates form: folder name", () => {
  it.each(["", "  ", "Templates", " Templates ", "Templates.Marketing", "Templates.Marketing.2026"])("accepts %j", (folderName) => {
    expect(provisionFolderError(folderName)).toBeNull();
  });

  it.each(["INBOX", "Sent", "templates", "Templates.", "TemplatesX", "INBOX.Templates"])("refuses %j", (folderName) => {
    expect(provisionFolderError(folderName)).toBe("provisionTemplates.folderNotTemplates");
  });

  it("reports the source user before the folder", () => {
    expect(provisionValuesError(" victim@b.org ", "INBOX", "a.org")).toBe("provisionTemplates.sourceUserOtherDomain");
    expect(provisionValuesError(" ref@a.org ", "INBOX", "a.org")).toBe("provisionTemplates.folderNotTemplates");
    expect(provisionValuesError(" ref@a.org ", "Templates.Marketing", "a.org")).toBeNull();
  });
});

describe("provision templates form: inline errors disable Run", () => {
  it("shows the folder help, then the error of a folder that is not a templates folder", () => {
    renderForm();
    const folder = screen.getByLabelText("provisionTemplates.folderName");
    expect(screen.getByText("provisionTemplates.folderNameHint")).not.toBeNull();
    expect(appearance.set).toHaveBeenLastCalledWith({ confirmDisabled: false });

    fireEvent.change(folder, { target: { value: "INBOX" } });

    expect(folder.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("provisionTemplates.folderNotTemplates")).not.toBeNull();
    expect(appearance.set).toHaveBeenLastCalledWith({ confirmDisabled: true });

    fireEvent.change(folder, { target: { value: "Templates.Marketing" } });

    expect(folder.getAttribute("aria-invalid")).toBe("false");
    expect(appearance.set).toHaveBeenLastCalledWith({ confirmDisabled: false });
  });

  it("flags a source user of another domain", () => {
    renderForm();
    const source = screen.getByLabelText("provisionTemplates.sourceUser");

    fireEvent.change(source, { target: { value: "victim@b.org" } });

    expect(source.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("provisionTemplates.sourceUserOtherDomain")).not.toBeNull();
    expect(appearance.set).toHaveBeenLastCalledWith({ confirmDisabled: true });
  });
});

const webAdminAnswer = (status: number, message: string) =>
  new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: status, type: "InvalidArgument", message, details: null },
  });

describe("provision templates refused by WebAdmin", () => {
  it("tells the source account 400 from the folder 400 by their message", () => {
    expect(refusedProvisionParam(webAdminAnswer(400, "'from' query parameter must be an account of the domain 'a.org'"))).toBe("source");
    expect(refusedProvisionParam(webAdminAnswer(400, "'from' query parameter must be an account of the target user's domain"))).toBe("source");
    expect(refusedProvisionParam(webAdminAnswer(400, "Invalid 'folderName' value 'INBOX'. Expected 'Templates' or one of its sub-folders."))).toBe("folder");
  });

  it("leaves any other error to the usual display", () => {
    expect(refusedProvisionParam(webAdminAnswer(400, "Invalid 'usersPerSecond'"))).toBeNull();
    expect(refusedProvisionParam(webAdminAnswer(500, "Invalid 'folderName' value 'INBOX'"))).toBeNull();
    expect(describeProvisionRefusal("a.org")(webAdminAnswer(404, "The source folder does not exist"))).toBeNull();
  });

  it("names the refused source account above the server message", () => {
    render(<>{describeProvisionRefusal("a.org")(webAdminAnswer(400, "'from' query parameter must be an account of the domain 'a.org'"))}</>);

    expect(screen.getByText("provisionTemplates.refused.source")).not.toBeNull();
    expect(screen.getByText("common.serverMessage")).not.toBeNull();
    expect(screen.getByText("'from' query parameter must be an account of the domain 'a.org'")).not.toBeNull();
  });
});
