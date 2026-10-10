// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ createMailRepository: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("./api-client", () => api);
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import CreateMailRepositoryButton from "./create-mail-repository-button";

const onCreated = vi.fn();

const openDialog = () => {
  render(<CreateMailRepositoryButton onCreated={onCreated} />);
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

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "mailRepositories.createError",
    })));
    expect(pathInput().value).toBe("var/mail/new");
    expect(onCreated).not.toHaveBeenCalled();
  });
});
