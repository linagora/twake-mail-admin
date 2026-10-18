// Runtime configuration of the admin app under test, Mail flavour. The URL is not a real
// host: the browser resolves it onto the port docker published WebAdmin on, see MailStack.
window.__ENV__ = {
  VITE_API_BASE_URL: "http://webadmin-mail",
  MODE: "GLOBAL",
  APPLICATION: "MAIL",
};
