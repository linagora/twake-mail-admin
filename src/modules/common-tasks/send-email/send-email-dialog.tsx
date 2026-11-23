import { ChangeEvent, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useToast } from "@/hooks/use-toast";
import { SEND_EMAIL_COMMAND, sendEmail } from "./api-client";
import { checkMessage, ComposedEmail, composeMessage, MessageProblem, withCrlf } from "./rfc822";

type Mode = "compose" | "raw";

const MODES: Mode[] = ["compose", "raw"];

const EMPTY_EMAIL: ComposedEmail = { from: "", to: "", cc: "", subject: "", body: "" };

const COMPOSER_FIELDS: (keyof Omit<ComposedEmail, "body">)[] = ["from", "to", "cc", "subject"];

const problemText = (t: TFunction, problem: MessageProblem): string => {
  switch (problem.kind) {
    case "invalidFrom":
      return t("sendEmail.problem.invalidFrom", { address: problem.address });
    case "invalidRecipient":
      return t("sendEmail.problem.invalidRecipient", { header: problem.header, address: problem.address });
    default:
      return t(`sendEmail.problem.${problem.kind}`);
  }
};

function Problems({ problems }: { problems: MessageProblem[] }) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite" className="text-sm text-amber-800">
      {problems.length > 0 && (
        <>
          <p className="font-medium">{t("sendEmail.cannotSend")}</p>
          <ul className="list-disc pl-5">
            {problems.map((problem) => <li key={problemText(t, problem)}>{problemText(t, problem)}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t("sendEmail.modeLabel")} className="inline-flex rounded-md border p-0.5 text-sm">
      {MODES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          className={`px-3 py-1 rounded ${mode === value ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
          onClick={() => onChange(value)}
        >
          {t(`sendEmail.mode.${value}`)}
        </button>
      ))}
    </div>
  );
}

function Composer({ email, onChange }: { email: ComposedEmail; onChange: (email: ComposedEmail) => void }) {
  const { t } = useTranslation();
  const update = (field: keyof ComposedEmail) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...email, [field]: event.target.value });
  return (
    <div className="space-y-2">
      {COMPOSER_FIELDS.map((field) => (
        <label key={field} className="block text-sm font-medium">
          {t(`sendEmail.field.${field}`)}
          <input className={FIELD_CLASS} value={email[field]} onChange={update(field)} placeholder={t(`sendEmail.placeholder.${field}`)} />
        </label>
      ))}
      <label className="block text-sm font-medium">
        {t("sendEmail.field.body")}
        <textarea className={FIELD_CLASS} rows={6} value={email.body} onChange={update("body")} />
      </label>
    </div>
  );
}

function RawMessage({ raw, onChange }: { raw: string; onChange: (raw: string) => void }) {
  const { t } = useTranslation();
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that loading the same file again, once edited, reads it again
    event.target.value = "";
    if (file) onChange(await file.text());
  };
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {t("sendEmail.field.eml")}
        <input type="file" accept=".eml,message/rfc822" className="block mt-1 text-sm" onChange={load} />
      </label>
      <label className="block text-sm font-medium">
        {t("sendEmail.field.raw")}
        <textarea
          className={`${FIELD_CLASS} font-mono text-xs`}
          rows={12}
          spellCheck={false}
          value={raw}
          onChange={(event) => onChange(event.target.value)}
          placeholder={"From: admin@domain.tld\nTo: user@domain.tld\nSubject: Hello\n\nBody"}
        />
      </label>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Sends an email through WebAdmin: composed in the dialog, or an RFC 822 message pasted or loaded
 * from an .eml file. Send stays disabled while the message lacks what WebAdmin requires; a refusal
 * keeps the dialog open, with what was typed, and shows the server message in it and in a toast.
 */
export default function SendEmailDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("compose");
  const [email, setEmail] = useState<ComposedEmail>(EMPTY_EMAIL);
  const [raw, setRaw] = useState("");
  // Composed again when sent: its Date is the time of sending
  const message = () => (mode === "compose" ? composeMessage(email) : withCrlf(raw));
  const problems = useMemo(() => checkMessage(mode === "compose" ? composeMessage(email) : raw), [mode, email, raw]);

  const close = () => {
    setMode("compose");
    setEmail(EMPTY_EMAIL);
    setRaw("");
    onClose();
  };

  const submit = async () => {
    try {
      await sendEmail(message());
    } catch (err) {
      toast({ title: t("sendEmail.refused"), description: <ErrorDisplayer error={err} /> });
      throw err;
    }
    toast({ title: t("sendEmail.enqueued") });
  };

  return (
    <FormDialog
      open={open}
      onClose={close}
      title={t("sendEmail.title")}
      submitLabel={t("sendEmail.send")}
      submitDisabled={problems.length > 0}
      onSubmit={submit}
      className="max-w-2xl"
    >
      <p className="text-sm text-muted-foreground">{t("sendEmail.intro")}</p>
      <ModeSwitch mode={mode} onChange={setMode} />
      {mode === "compose" ? <Composer email={email} onChange={setEmail} /> : <RawMessage raw={raw} onChange={setRaw} />}
      <Problems problems={problems} />
      <p className="break-words text-sm">
        <span className="font-medium">{t("confirmTask.commandLabel")}</span>{" "}
        <code className="font-mono text-xs">{SEND_EMAIL_COMMAND}</code>
      </p>
    </FormDialog>
  );
}
