// Runtime configuration of the admin app under test, Calendar flavour. The URL is not a real
// host: the browser resolves it onto the port docker published WebAdmin on, see CalendarStack.
window.__ENV__ = {
  VITE_API_BASE_URL: "http://webadmin-calendar",
  MODE: "GLOBAL",
  APPLICATION: "CALENDAR",
};
