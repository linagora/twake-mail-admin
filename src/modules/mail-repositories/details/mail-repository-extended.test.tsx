// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const http = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock(import("@/lib/apiClient"), async (importOriginal) => ({
  ...(await importOriginal()),
  apiClient: { get: http.get } as never,
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn(async () => false) }));
vi.mock("@/lib/proxy-resolver-context", () => ({ useIsAllowed: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
// The keys as text; the labelled key wraps its label
const t = vi.hoisted(() => (key: string, options?: Record<string, unknown>) =>
  key === "tasks.labelled" ? `labelled(${options?.label})` : key);
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import MailRepositoryExtended from "./mail-repository-extended";

const mailDetail = {
  name: "mail-001",
  sender: "qa@example.com",
  recipients: ["bob@example.com"],
  state: "error",
  error: "",
  remoteHost: "",
  remoteAddr: "",
  lastUpdated: null,
};

function answer(url: string) {
  if (url === "/mailRepositories") return Promise.resolve([{ repository: "var/mail/error" }]);
  if (url.includes("/mails?")) return Promise.resolve([mailDetail.name]);
  // WebAdmin only sends the size of the message when asked for it
  return Promise.resolve(url.endsWith("?additionalFields=messageSize") ? { ...mailDetail, messageSize: 123 } : mailDetail);
}

function renderExtended() {
  render(
    <MemoryRouter initialEntries={["/mail-repositories/repository/var%2Fmail%2Ferror/extended?size=1"]}>
      <Routes>
        <Route path="/mail-repositories/repository/:id/extended" element={<MailRepositoryExtended />} />
      </Routes>
    </MemoryRouter>
  );
}

const columnClasses = (element: HTMLElement) =>
  Array.from(element.classList).filter((name) => name.includes("grid-cols-"));

beforeEach(() => {
  http.get.mockReset().mockImplementation(answer);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mail repository extended view: layout", () => {
  it("lays the header and the rows out on the same column template", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");

    expect(columnClasses(row)).not.toEqual([]);
    expect(columnClasses(screen.getByTestId("mail-repository-extended-header"))).toEqual(columnClasses(row));
  });

  it("hides the header below md, where the rows stack their fields", async () => {
    renderExtended();
    await screen.findByTestId("mail-repository-extended-row");

    const header = screen.getByTestId("mail-repository-extended-header");

    expect(header.classList).toContain("hidden");
    expect(header.classList).toContain("md:grid");
  });

  it("labels the recipients, the date and the size of a stacked row", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");

    expect(within(row).getByText("labelled(mailRepositories.colRecipients)")).not.toBeNull();
    expect(within(row).getByText("labelled(mailRepositories.colLastUpdated)")).not.toBeNull();
    expect(within(row).getByText("labelled(mailRepositories.colSize)")).not.toBeNull();
    expect(within(row).getByText("labelled(mailRepositories.colRecipients)").parentElement!.textContent)
      .toContain("bob@example.com");
  });

  it("keeps each stacked value in an element of its own, apart from its label", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");

    // The e2e suite reads the size as /^\d+ B$/: the label must not be part of its element
    // i18next is not initialized here: the unit may be rendered empty
    expect(within(row).getByText(/^\d+( .*)?$/).textContent).toMatch(/^\d+ /);
    expect(within(row).getByText("bob@example.com").textContent).toBe("bob@example.com");
  });

  it("only truncates the name, sender and recipients from the md breakpoint", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");
    const nameCell = within(row).getByText("mail-001").parentElement!;
    const recipientsCell = within(row).getByText("labelled(mailRepositories.colRecipients)").parentElement!;

    [nameCell, recipientsCell].forEach((cell) => {
      expect(cell.classList).not.toContain("truncate");
      expect(cell.classList).toContain("md:truncate");
    });
  });

  it("lets a name without break points wrap on a phone, and truncates it with an ellipsis from md", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");
    const nameButton = within(row).getByRole("button", { name: "mail-001" });

    // An inline-block button is sized by its content: it must be a block bounded by its cell
    expect(nameButton.classList).toContain("block");
    expect(nameButton.classList).toContain("max-w-full");
    expect(nameButton.classList).toContain("[overflow-wrap:anywhere]");
    expect(nameButton.classList).toContain("md:truncate");
    expect(nameButton.classList).not.toContain("truncate");
  });

  it("lets recipients without break points wrap on a phone", async () => {
    renderExtended();

    const row = await screen.findByTestId("mail-repository-extended-row");
    const recipientsCell = within(row).getByText("labelled(mailRepositories.colRecipients)").parentElement!;

    expect(recipientsCell.classList).toContain("[overflow-wrap:anywhere]");
  });
});

describe("mail repository extended view: size", () => {
  // A long key and a short message: the size must be the message's, not the length of the detail
  const mails: Record<string, number> = { ["k-" + "x".repeat(60)]: 300, "k-short": 900 };

  beforeEach(() => {
    http.get.mockImplementation((url: string) => {
      if (url === "/mailRepositories") return Promise.resolve([{ repository: "var/mail/error" }]);
      if (url.includes("/mails?")) return Promise.resolve(Object.keys(mails));
      const key = Object.keys(mails).find((k) => url.includes(`/mails/${k}`))!;
      return Promise.resolve({ ...mailDetail, name: key, ...(url.endsWith("?additionalFields=messageSize") && { messageSize: mails[key] }) });
    });
  });

  it("asks WebAdmin for the size of each message and sorts on it", async () => {
    renderExtended();
    await screen.findAllByTestId("mail-repository-extended-row");

    expect(http.get).toHaveBeenCalledWith(
      `/mailRepositories/var%2Fmail%2Ferror/mails/k-short?additionalFields=messageSize`,
      expect.anything()
    );
    // Each row as "<key kind> <size>"
    const rows = () => screen.getAllByTestId("mail-repository-extended-row").map((row) =>
      `${row.textContent!.includes("k-short") ? "short" : "long"} ${within(row).getByText(/^\d+( .*)?$/).textContent!.split(" ")[0]}`);

    fireEvent.change(screen.getByLabelText("mailRepositories.sortBy"), { target: { value: "size" } });
    const firstOrder = rows();
    fireEvent.click(screen.getByText(/mailRepositories\.sort(Asc|Desc)/));
    const secondOrder = rows();

    expect([firstOrder, secondOrder]).toContainEqual(["long 300", "short 900"]);
    expect([firstOrder, secondOrder]).toContainEqual(["short 900", "long 300"]);
  });
});
