// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ConfirmProvider, ConfirmValidator } from "./confirm-provider";
import { useConfirm } from "@/hooks/use-confirm";

function NameForm({ onChange }: { onChange: (value: string) => void }) {
  const [name, setName] = useState("");
  return (
    <input
      aria-label="name"
      value={name}
      onChange={(e) => { setName(e.target.value); onChange(e.target.value); }}
    />
  );
}

function Opener({ onResult }: { onResult: (result: boolean, name: string) => void }) {
  const confirm = useConfirm();
  const open = async () => {
    let name = "";
    const validate: ConfirmValidator = () => (name.trim() ? null : "Name is required");
    const result = await confirm({
      header: "Rename",
      message: <NameForm onChange={(value) => { name = value; }} />,
      validate,
    });
    onResult(result, name);
  };
  return <button onClick={open}>open</button>;
}

const results: Array<{ result: boolean; name: string }> = [];

const openDialog = () => {
  render(
    <ConfirmProvider>
      <Opener onResult={(result, name) => results.push({ result, name })} />
    </ConfirmProvider>
  );
  fireEvent.click(screen.getByText("open"));
};

const nameInput = () => screen.getByLabelText("name") as HTMLInputElement;
const clickConfirm = () => fireEvent.click(screen.getByText("common.confirm"));

afterEach(() => {
  cleanup();
  results.length = 0;
});

describe("confirm dialog validation", () => {
  it("stays open and reports the error when the validation fails", async () => {
    openDialog();
    await screen.findByText("Rename");
    clickConfirm();

    expect(screen.getByRole("alert").textContent).toBe("Name is required");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(results).toHaveLength(0);
  });

  it("keeps the typed content while reporting the error", async () => {
    openDialog();
    await screen.findByText("Rename");
    fireEvent.change(nameInput(), { target: { value: "   " } });
    clickConfirm();

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(nameInput().value).toBe("   ");
  });

  it("clears the error once the content is edited", async () => {
    openDialog();
    await screen.findByText("Rename");
    clickConfirm();
    fireEvent.change(nameInput(), { target: { value: "bob" } });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resolves and closes once the validation passes", async () => {
    openDialog();
    await screen.findByText("Rename");
    clickConfirm();
    fireEvent.change(nameInput(), { target: { value: "bob" } });
    clickConfirm();

    await waitFor(() => expect(results).toEqual([{ result: true, name: "bob" }]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resolves false on cancel without validating", async () => {
    openDialog();
    await screen.findByText("Rename");
    fireEvent.click(screen.getByText("common.cancel"));

    await waitFor(() => expect(results).toEqual([{ result: false, name: "" }]));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

function ActionOpener({ action, onResult }: { action: (name: string) => Promise<unknown>; onResult: (result: boolean) => void }) {
  const confirm = useConfirm();
  const open = async () => {
    let name = "";
    const result = await confirm({
      header: "Rename",
      message: <NameForm onChange={(value) => { name = value; }} />,
      action: () => action(name),
    });
    onResult(result);
  };
  return <button onClick={open}>open</button>;
}

describe("confirm dialog action", () => {
  const actionResults: boolean[] = [];

  afterEach(() => {
    actionResults.length = 0;
  });

  const openActionDialog = (action: (name: string) => Promise<unknown>) => {
    render(
      <ConfirmProvider>
        <ActionOpener action={action} onResult={(result) => actionResults.push(result)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText("open"));
  };

  it("sends the request with the typed content and closes once it succeeds", async () => {
    const sent: string[] = [];
    openActionDialog(async (name) => { sent.push(name); });
    await screen.findByText("Rename");
    fireEvent.change(nameInput(), { target: { value: "bob" } });
    clickConfirm();

    await waitFor(() => expect(actionResults).toEqual([true]));
    expect(sent).toEqual(["bob"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open with the typed content and reports why the request was refused", async () => {
    openActionDialog(async () => { throw new Error("'newUser' parameter should be an existing user"); });
    await screen.findByText("Rename");
    fireEvent.change(nameInput(), { target: { value: "ghost" } });
    clickConfirm();

    expect((await screen.findByRole("alert")).textContent).toContain("'newUser' parameter should be an existing user");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(nameInput().value).toBe("ghost");
    expect(actionResults).toHaveLength(0);
  });

  it("sends the corrected content when confirmed again after a refusal", async () => {
    const sent: string[] = [];
    openActionDialog(async (name) => {
      sent.push(name);
      if (name === "ghost") throw new Error("refused");
    });
    await screen.findByText("Rename");
    fireEvent.change(nameInput(), { target: { value: "ghost" } });
    clickConfirm();
    await screen.findByRole("alert");
    fireEvent.change(nameInput(), { target: { value: "bob" } });
    clickConfirm();

    await waitFor(() => expect(actionResults).toEqual([true]));
    expect(sent).toEqual(["ghost", "bob"]);
  });

  it("cannot be cancelled while the request is in flight", async () => {
    let succeed: () => void = () => {};
    openActionDialog(() => new Promise<void>((resolve) => { succeed = resolve; }));
    await screen.findByText("Rename");
    clickConfirm();

    await waitFor(() => expect((screen.getByText("common.cancel") as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByText("common.cancel"));
    expect(screen.queryByRole("dialog")).not.toBeNull();

    succeed();
    await waitFor(() => expect(actionResults).toEqual([true]));
  });
});

describe("confirm dialog focus", () => {
  it("returns the focus to the control that opened it once closed", async () => {
    render(
      <ConfirmProvider>
        <Opener onResult={(result, name) => results.push({ result, name })} />
      </ConfirmProvider>
    );
    const opener = screen.getByText("open");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(await screen.findByText("common.cancel"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Radix moves the focus on close from a timeout
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("confirm dialog validation without message", () => {
  function SilentOpener({ onResult }: { onResult: (result: boolean) => void }) {
    const confirm = useConfirm();
    const open = async () => onResult(await confirm({
      header: "Restore",
      message: <p role="alert">Complete the criteria</p>,
      validate: () => false,
    }));
    return <button onClick={open}>open</button>;
  }

  it("stays open without adding an error when the content already reports the problem", async () => {
    const silentResults: boolean[] = [];
    render(
      <ConfirmProvider>
        <SilentOpener onResult={(result) => silentResults.push(result)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Restore");

    clickConfirm();

    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual(["Complete the criteria"]);
    expect(silentResults).toEqual([]);
  });
});
