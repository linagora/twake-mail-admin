import { describe, expect, it } from "vitest";
import { deleteAllUsersDataCommand, provisionDomainTemplatesCommand } from "./domain-task-commands";

const DOMAIN = "example.com";

describe("domain task commands", () => {
  it("previews the provision templates call with a placeholder until a source user is typed", () => {
    expect(provisionDomainTemplatesCommand(DOMAIN, { sourceUser: "", folderName: "", overwriteExisting: false, prune: false, usersPerSecond: "1" }))
      .toBe("curl -XPOST /domains/example.com/templates?action=provision&from={sourceUser}&usersPerSecond=1");
  });

  it("previews the provision templates call with every option", () => {
    expect(provisionDomainTemplatesCommand(DOMAIN, { sourceUser: "alice@example.com", folderName: " Tpl", overwriteExisting: true, prune: true, usersPerSecond: " " }))
      .toBe("curl -XPOST /domains/example.com/templates?action=provision&from=alice@example.com&folderName=Tpl&overwriteExisting=true&prune=true");
  });

  it("previews the delete all users data call", () => {
    expect(deleteAllUsersDataCommand(DOMAIN)).toBe("curl -XPOST /domains/example.com?action=deleteData");
  });
});
