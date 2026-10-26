// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ConfirmOptions, ConfirmProvider, ConfirmValidator, matchesTypeToConfirm } from "./confirm-provider";
import { useConfirm } from "@/hooks/use-confirm";
import { Link, MemoryRouter } from "react-router";
import FormTaskContent from "@/modules/common-tasks/components/form-task-content";

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

describe("confirm dialog edited by a click", () => {
  function ItemsForm({ onChange }: { onChange: (items: string[]) => void }) {
    const [items, setItems] = useState([""]);
    const remove = () => { setItems([]); onChange([]); };
    return <ul>{items.map((_, index) => <li key={index}><button onClick={remove}>remove</button></li>)}</ul>;
  }

  function ItemsOpener() {
    const confirm = useConfirm();
    const open = () => {
      let items = [""];
      confirm({
        header: "Restore",
        message: (
          <FormTaskContent
            initialValues={items}
            renderForm={(onChange) => <ItemsForm onChange={onChange} />}
            buildCommand={(values) => `items: ${values.length}`}
            onChange={(values) => { items = values; }}
          />
        ),
        validate: () => (items.every(Boolean) ? null : "Complete or remove every item"),
      });
    };
    return <button onClick={open}>open</button>;
  }

  it("clears the error once the content reports a change that is not typed in a field", async () => {
    render(<ConfirmProvider><ItemsOpener /></ConfirmProvider>);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByText("confirmTask.start"));
    expect(screen.getByRole("alert").textContent).toBe("Complete or remove every item");

    fireEvent.click(screen.getByText("remove"));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("destructive confirm dialog", () => {
  function DestructiveOpener({ options, onResult }: { options: Partial<ConfirmOptions>; onResult: (result: boolean) => void }) {
    const confirm = useConfirm();
    const open = async () => onResult(await confirm({ header: "Delete", message: "Sure?", destructive: true, ...options }));
    return <button onClick={open}>open</button>;
  }

  const destructiveResults: boolean[] = [];
  afterEach(() => { destructiveResults.length = 0; });

  const openDestructive = async (options: Partial<ConfirmOptions> = {}) => {
    render(
      <ConfirmProvider>
        <DestructiveOpener options={options} onResult={(result) => destructiveResults.push(result)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText("open"));
    await screen.findByRole("dialog");
  };

  it("is described by its text message", async () => {
    await openDestructive({ message: "Delete all signature templates for domain \"example.com\"?" });

    expect(screen.getByRole("dialog", { description: "Delete all signature templates for domain \"example.com\"?" })).not.toBeNull();
  });

  it("names the action on a red button and shows the consequence", async () => {
    await openDestructive({ confirmLabel: "Delete user data", consequence: "Everything is lost" });

    const button = screen.getByText("Delete user data");
    expect(button.className).toContain("bg-destructive");
    expect(screen.getByText("Everything is lost")).not.toBeNull();
    expect(screen.queryByText("common.confirm")).toBeNull();
  });

  it("opens with the focus on Cancel", async () => {
    await openDestructive();

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("common.cancel")));
  });

  it("keeps the blue Confirm of a routine confirmation", async () => {
    await openDestructive({ destructive: false });

    expect(screen.getByText("common.confirm").className).not.toContain("bg-destructive");
  });

  it("enables the confirm button only once the target is typed", async () => {
    await openDestructive({ confirmLabel: "Delete", typeToConfirm: "bob@example.com", typeToConfirmIgnoreCase: true });
    const button = () => screen.getAllByText("Delete").find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    const field = screen.getByLabelText("confirm.typeToConfirm");

    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(button().disabled).toBe(true);
    fireEvent.change(field, { target: { value: "bob" } });
    expect(button().disabled).toBe(true);
    fireEvent.change(field, { target: { value: " BOB@example.com " } });
    expect(button().disabled).toBe(false);
    fireEvent.click(button());

    await waitFor(() => expect(destructiveResults).toEqual([true]));
  });

  it("compares the typed text exactly unless told otherwise", async () => {
    await openDestructive({ confirmLabel: "Delete", typeToConfirm: "INBOX" });
    const button = () => screen.getAllByText("Delete").find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    const field = screen.getByLabelText("confirm.typeToConfirm");

    fireEvent.change(field, { target: { value: "inbox" } });
    expect(button().disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(destructiveResults).toEqual([]);
    fireEvent.change(field, { target: { value: "INBOX" } });
    expect(button().disabled).toBe(false);
  });
});

describe("matchesTypeToConfirm", () => {
  it("ignores surrounding spaces, and the case only when asked", () => {
    expect(matchesTypeToConfirm(" ux.org ", "ux.org")).toBe(true);
    expect(matchesTypeToConfirm("UX.org", "ux.org")).toBe(false);
    expect(matchesTypeToConfirm("UX.org", "ux.org", true)).toBe(true);
    expect(matchesTypeToConfirm("", "ux.org", true)).toBe(false);
  });
});

describe("confirm dialog navigation", () => {
  it("points at no missing description when its message is a content", async () => {
    function ContentOpener() {
      const confirm = useConfirm();
      return <button onClick={() => confirm({ header: "Rename", message: <input aria-label="name" /> })}>open</button>;
    }
    render(<ConfirmProvider><ContentOpener /></ConfirmProvider>);
    fireEvent.click(screen.getByText("open"));

    expect((await screen.findByRole("dialog")).hasAttribute("aria-describedby")).toBe(false);
  });

  it("is cancelled when a link of its content leaves the page", async () => {
    const outcomes: boolean[] = [];
    function LinkOpener() {
      const confirm = useConfirm();
      return (
        <button onClick={async () => outcomes.push(await confirm({ header: "Delete", message: <Link to="/users">users</Link> }))}>
          open
        </button>
      );
    }
    render(
      <MemoryRouter initialEntries={["/domains"]}>
        <ConfirmProvider>
          <LinkOpener />
        </ConfirmProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByRole("link", { name: "users" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(outcomes).toEqual([false]);
  });
});
