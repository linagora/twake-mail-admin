// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";

const api = vi.hoisted(() => ({ createMailRepository: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("./api-client", () => api);
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import CreateMailRepositoryButton from "./create-mail-repository-button";

const onCreated = vi.fn();

const openDialog = () => {
  render(<CreateMailRepositoryButton existingRepositories={["var/mail/error"]} onCreated={onCreated} />);
  fireEvent.click(screen.getByText("mailRepositories.newRepository"));
};

const pathInput = () => screen.getByLabelText(/mailRepositories.pathLabel/) as HTMLInputElement;
const protocolInput = () => screen.getByLabelText(/mailRepositories.protocolLabel/) as HTMLInputElement;
const confirm = () => fireEvent.click(screen.getByText("common.confirm"));

beforeEach(() => {
  api.createMailRepository.mockReset();
  toast.mockReset();
  onCreated.mockReset();
});

afterEach(cleanup);

describe("create mail repository dialog", () => {
  it("shows a single required marker per label", () => {
    openDialog();

    expect(screen.getAllByText("*")).toHaveLength(2);
  });

  it("stays open, keeps the typed path and flags the missing protocol", () => {
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/qa-typed" } });
    fireEvent.change(protocolInput(), { target: { value: "" } });
    confirm();

    expect(screen.getByText("mailRepositories.protocolRequired")).not.toBeNull();
    expect(screen.queryByText("mailRepositories.pathRequired")).toBeNull();
    expect(pathInput().value).toBe("var/mail/qa-typed");
    expect(protocolInput().getAttribute("aria-invalid")).toBe("true");
    expect(api.createMailRepository).not.toHaveBeenCalled();
  });

  it("flags a protocol made only of spaces, without calling WebAdmin", () => {
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/qa-blank" } });
    fireEvent.change(protocolInput(), { target: { value: "   " } });
    confirm();

    expect(screen.getByText("mailRepositories.protocolRequired")).not.toBeNull();
    expect(api.createMailRepository).not.toHaveBeenCalled();
  });

  it("suggests the usual protocols and tells they must be supported by the server", () => {
    openDialog();

    const suggestions = document.getElementById(protocolInput().getAttribute("list")!)!;
    expect(Array.from(suggestions.querySelectorAll("option"), (o) => o.value))
      .toEqual(["cassandra", "postgres", "file", "memory"]);
    const hint = document.getElementById(protocolInput().getAttribute("aria-describedby")!)!;
    expect(hint.textContent).toBe("mailRepositories.protocolHint");
    expect(protocolInput().getAttribute("aria-required")).toBe("true");
  });

  it("sends the trimmed protocol", async () => {
    api.createMailRepository.mockResolvedValue(undefined);
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/qa-trim" } });
    fireEvent.change(protocolInput(), { target: { value: "  memory " } });
    confirm();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createMailRepository).toHaveBeenCalledWith(encodeURIComponent("var/mail/qa-trim"), "memory");
  });

  it("flags a blank path", () => {
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "   " } });
    confirm();

    expect(screen.getByText("mailRepositories.pathRequired")).not.toBeNull();
    expect(api.createMailRepository).not.toHaveBeenCalled();
  });

  it("clears the error once the field is filled", () => {
    openDialog();
    confirm();
    fireEvent.change(pathInput(), { target: { value: "var/mail/x" } });

    expect(screen.queryByText("mailRepositories.pathRequired")).toBeNull();
  });

  it("refuses the path of an existing repository, without calling WebAdmin", () => {
    openDialog();
    fireEvent.change(pathInput(), { target: { value: " var/mail/error " } });
    confirm();

    expect(screen.getByText("mailRepositories.alreadyExists")).not.toBeNull();
    expect(pathInput().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("mailRepositories.createTitle")).not.toBeNull();
    expect(api.createMailRepository).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("clears the existing repository refusal once the path is edited", () => {
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/error" } });
    confirm();
    fireEvent.change(pathInput(), { target: { value: "var/mail/error2" } });

    expect(screen.queryByText("mailRepositories.alreadyExists")).toBeNull();
    expect(pathInput().getAttribute("aria-invalid")).toBe("false");
  });

  it.each(["../../etc", "var//mail/qa-repo", "var/mail/qa-repo/", "/var/mail/qa-repo", "var/mail/./qa-dot"])(
    "refuses the malformed path %s, without calling WebAdmin",
    (path) => {
      openDialog();
      fireEvent.change(pathInput(), { target: { value: path } });
      confirm();

      expect(screen.getByText("mailRepositories.malformedPath")).not.toBeNull();
      expect(pathInput().getAttribute("aria-invalid")).toBe("true");
      expect(api.createMailRepository).not.toHaveBeenCalled();

      fireEvent.change(pathInput(), { target: { value: "var/mail/qa-repo" } });
      expect(screen.queryByText("mailRepositories.malformedPath")).toBeNull();
    }
  );

  it("accepts dots inside a part of the path", async () => {
    api.createMailRepository.mockResolvedValue(undefined);
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/.hidden/a..b" } });
    confirm();

    await waitFor(() => expect(api.createMailRepository).toHaveBeenCalledWith("var%2Fmail%2F.hidden%2Fa..b", "cassandra"));
  });

  it("creates a path differing from an existing one only by its case", async () => {
    api.createMailRepository.mockResolvedValue(undefined);
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/ERROR" } });
    confirm();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("creates the repository with the default protocol and closes", async () => {
    api.createMailRepository.mockResolvedValue(undefined);
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/new" } });
    confirm();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createMailRepository).toHaveBeenCalledWith(encodeURIComponent("var/mail/new"), "cassandra");
    expect(screen.queryByText("mailRepositories.createTitle")).toBeNull();
  });

  it("stays open with the typed values when the creation fails", async () => {
    api.createMailRepository.mockRejectedValue(new Error("boom"));
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/new" } });
    confirm();

    // In the dialog, not in a toast: the dialog keeps the focus, a toast over it cannot be selected
    expect((await screen.findByRole("alert")).textContent).toContain("mailRepositories.createError");
    expect(toast).not.toHaveBeenCalled();
    expect(pathInput().value).toBe("var/mail/new");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows the WebAdmin reason of an unsupported protocol and lets it be fixed", async () => {
    api.createMailRepository.mockRejectedValue(new AxiosError(
      "Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        statusText: "Bad Request",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { type: "InvalidArgument", message: "'nosuchproto' is an unsupported protocol" },
      }));
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/qa-bad" } });
    fireEvent.change(protocolInput(), { target: { value: "nosuchproto" } });
    confirm();

    // The server message, labelled and selectable as in every error display
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("common.serverMessage");
    expect(screen.getByText("'nosuchproto' is an unsupported protocol")).not.toBeNull();
    expect(protocolInput().value).toBe("nosuchproto");
    expect(pathInput().value).toBe("var/mail/qa-bad");
    expect(toast).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("clears the refusal once a field is edited", async () => {
    api.createMailRepository.mockRejectedValue(new Error("boom"));
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/new" } });
    confirm();
    await screen.findByRole("alert");

    fireEvent.change(protocolInput(), { target: { value: "memory" } });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("forgets the refusal once the dialog is cancelled", async () => {
    api.createMailRepository.mockRejectedValue(new Error("boom"));
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/new" } });
    confirm();
    await screen.findByRole("alert");

    fireEvent.click(screen.getByText("common.cancel"));
    fireEvent.click(screen.getByText("mailRepositories.newRepository"));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  // jsdom does not submit a form on Enter: submitting the field's form is what the browser does then
  it("creates the repository on Enter in a field, like Confirm", async () => {
    api.createMailRepository.mockResolvedValue(undefined);
    openDialog();
    fireEvent.change(pathInput(), { target: { value: "var/mail/qa-enter" } });
    fireEvent.submit(protocolInput().form!);

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.createMailRepository).toHaveBeenCalledWith(encodeURIComponent("var/mail/qa-enter"), "cassandra");
  });

  it("flags a missing field on Enter", () => {
    openDialog();
    fireEvent.submit(pathInput().form!);

    expect(screen.getByText("mailRepositories.pathRequired")).not.toBeNull();
    expect(api.createMailRepository).not.toHaveBeenCalled();
  });
});
