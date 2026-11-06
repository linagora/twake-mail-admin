import { describe, expect, it } from "vitest";
import i18n, { supportedLanguages } from "@/i18n";

const USER = "charlotte@open-paas.org";

const consequence = (code: string): string =>
  i18n.getFixedT(code)("confirm.consequence.deleteRegisteredUser", { user: USER });

const translations = supportedLanguages.map((language) => language.code).filter((code) => code !== "en");

describe("consequence of deleting a registered user", () => {
  it("states what the user and their delegates lose", () => {
    expect(consequence("en")).toBe(
      `${USER} loses access to every user, team and resource calendar delegated to them. `
      + `The delegations ${USER} granted on their own calendars are revoked, so their delegates lose those calendars.`
    );
  });

  it.each(["en", ...translations])("names the user in both consequences in %s", (code) => {
    expect(consequence(code).split(USER)).toHaveLength(3);
  });

  it.each(translations)("is translated in %s", (code) => {
    expect(consequence(code)).not.toBe(consequence("en"));
  });
});
