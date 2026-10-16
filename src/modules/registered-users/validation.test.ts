import { describe, expect, it } from "vitest";
import { isValidEmail, validateRegisteredUser, validateRegisteredUserNames } from "./validation";

const t = (key: string) => key;

describe("isValidEmail", () => {
  it.each(["charlotte@open-paas.org", " bob@domain.tld ", "a@b"])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(["", "not an email", "charlotte", "@open-paas.org", "charlotte@", "a b@c.d", "a@b@c"])("refuses '%s'", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("validateRegisteredUserNames", () => {
  it("accepts a firstname and a lastname", () => {
    expect(validateRegisteredUserNames({ firstname: "Charlotte", lastname: "QA" }, t)).toBeNull();
  });

  it("requires a firstname", () => {
    expect(validateRegisteredUserNames({ firstname: "  ", lastname: "QA" }, t)).toBe("registeredUsers.firstnameRequired");
  });

  it("requires a lastname", () => {
    expect(validateRegisteredUserNames({ firstname: "Emma", lastname: "" }, t)).toBe("registeredUsers.lastnameRequired");
  });
});

describe("validateRegisteredUser", () => {
  it("accepts a valid e-mail with names", () => {
    expect(validateRegisteredUser({ email: "charlotte@open-paas.org", firstname: "Charlotte", lastname: "QA" }, t)).toBeNull();
  });

  it("refuses an invalid e-mail", () => {
    expect(validateRegisteredUser({ email: "not an email", firstname: "Charlotte", lastname: "QA" }, t)).toBe("registeredUsers.invalidEmail");
  });

  it("requires the names", () => {
    expect(validateRegisteredUser({ email: "charlotte@open-paas.org", firstname: "", lastname: "QA" }, t)).toBe("registeredUsers.firstnameRequired");
  });
});
