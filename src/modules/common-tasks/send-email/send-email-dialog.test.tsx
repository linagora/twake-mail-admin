// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";

const webadmin = vi.hoisted(() => ({ post: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({ apiClient: webadmin }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import SendEmailDialog from "./send-email-dialog";

const onClose = vi.fn();

// As a textarea gives it back, LF only; sent with CRLF
const RAW_MESSAGE = "From: alice@domain.tld\nTo: bob@domain.tld\nSubject: hi\n\nbody\n";
const SENT_MESSAGE = RAW_MESSAGE.replace(/\n/g, "\r\n");

const badRequest = (message: string) => new AxiosError(
  "Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 400, type: "InvalidArgument", message, details: null },
  });

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const sendButton = () => screen.getByRole("button", { name: "sendEmail.send" }) as HTMLButtonElement;
const switchToRaw = () => fireEvent.click(screen.getByRole("button", { name: "sendEmail.mode.raw" }));

beforeEach(() => {
  webadmin.post.mockReset();
  toast.mockReset();
  onClose.mockReset();
  render(<SendEmailDialog open onClose={onClose} />);
});

afterEach(cleanup);

describe("send email dialog: checks before sending", () => {
  it("disables Send and says what is missing on an empty composer", () => {
    expect(sendButton().disabled).toBe(true);
    expect(screen.getByText("sendEmail.problem.noFrom")).not.toBeNull();
    expect(screen.getByText("sendEmail.problem.noRecipient")).not.toBeNull();
  });

  it("names an invalid sender or recipient", () => {
    type("sendEmail.field.from", "not an address");
    type("sendEmail.field.to", "bob@domain.tld, bob");

    expect(sendButton().disabled).toBe(true);
    expect(screen.getByText("sendEmail.problem.invalidFrom")).not.toBeNull();
    expect(screen.getByText("sendEmail.problem.invalidRecipient")).not.toBeNull();
  });

  it("enables Send once the composer has a valid sender and recipient", () => {
    type("sendEmail.field.from", "alice@domain.tld");
    type("sendEmail.field.cc", "bob@domain.tld");

    expect(sendButton().disabled).toBe(false);
    expect(screen.queryByText("sendEmail.cannotSend")).toBeNull();
  });

  it("checks a pasted message", () => {
    switchToRaw();
    expect(screen.getByText("sendEmail.problem.empty")).not.toBeNull();

    type("sendEmail.field.raw", "To: bob@domain.tld\r\n\r\nbody");
    expect(screen.getByText("sendEmail.problem.noFrom")).not.toBeNull();
    expect(sendButton().disabled).toBe(true);
  });

  it("loads an .eml file into the raw message", async () => {
    switchToRaw();
    const file = new File([SENT_MESSAGE], "message.eml", { type: "message/rfc822" });
    fireEvent.change(field("sendEmail.field.eml"), { target: { files: [file] } });

    await waitFor(() => expect(field("sendEmail.field.raw").value).toBe(RAW_MESSAGE));
    expect(sendButton().disabled).toBe(false);
  });

  it("previews the command", () => {
    expect(screen.getByText(/^curl -XPOST \/mail-transfer-service -H "Content-Type: message\/rfc822"/)).not.toBeNull();
  });
});

describe("send email dialog: sending", () => {
  it("posts the raw message as message/rfc822, says it is enqueued and closes", async () => {
    webadmin.post.mockResolvedValue("");
    switchToRaw();
    type("sendEmail.field.raw", RAW_MESSAGE);
    fireEvent.click(sendButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(webadmin.post).toHaveBeenCalledWith("/mail-transfer-service", SENT_MESSAGE, { headers: { "Content-Type": "message/rfc822" } });
    expect(toast).toHaveBeenCalledWith({ title: "sendEmail.enqueued" });
  });

  it("posts the composed message", async () => {
    webadmin.post.mockResolvedValue("");
    type("sendEmail.field.from", "alice@domain.tld");
    type("sendEmail.field.to", "bob@domain.tld");
    type("sendEmail.field.subject", "Hello");
    fireEvent.click(sendButton());

    await waitFor(() => expect(webadmin.post).toHaveBeenCalled());
    const sent = webadmin.post.mock.calls[0][1] as string;
    expect(sent).toMatch(/^From: alice@domain\.tld\r\nTo: bob@domain\.tld\r\nSubject: Hello\r\n/);
  });

  it("keeps the dialog open with the message on a 400 and shows the server message in place and in a toast", async () => {
    webadmin.post.mockRejectedValue(badRequest("The message must have at least one recipient ('To', 'Cc' or 'Bcc')"));
    switchToRaw();
    type("sendEmail.field.raw", RAW_MESSAGE);
    fireEvent.click(sendButton());

    expect(await screen.findByText("The message must have at least one recipient ('To', 'Cc' or 'Bcc')")).not.toBeNull();
    expect(screen.queryByText("Request failed with status code 400")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(field("sendEmail.field.raw").value).toBe(RAW_MESSAGE);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "sendEmail.refused" }));
    expect(toast).not.toHaveBeenCalledWith({ title: "sendEmail.enqueued" });
  });
});
