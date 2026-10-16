import { describe, expect, it } from "vitest";
import {
  buildRestoreRequest,
  deleteAllMailboxesCommand,
  deleteUserDataCommand,
  provisionTemplatesCommand,
  renameUserCommand,
  restoreDeletedMessagesCommand,
  subscribeAllCommand,
} from "./user-task-commands";

const USER = "bob@example.com";

describe("user task commands", () => {
  it("previews the subscribe all call", () => {
    expect(subscribeAllCommand(USER)).toBe("curl -XPOST /users/bob@example.com/mailboxes?task=subscribeAll");
  });

  it("previews the delete all mailboxes call", () => {
    expect(deleteAllMailboxesCommand(USER)).toBe("curl -XDELETE /users/bob@example.com/mailboxes");
  });

  it("previews the provision templates call with a placeholder until a source user is typed", () => {
    expect(provisionTemplatesCommand(USER, { sourceUser: " ", folderName: "", overwriteExisting: false, prune: false, usersPerSecond: "1" }))
      .toBe("curl -XPOST /users/bob@example.com/templates?action=provision&from={sourceUser}");
  });

  it("previews the provision templates call with every option", () => {
    expect(provisionTemplatesCommand(USER, { sourceUser: "ref@example.com ", folderName: " Tpl", overwriteExisting: true, prune: true, usersPerSecond: "1" }))
      .toBe("curl -XPOST /users/bob@example.com/templates?action=provision&from=ref@example.com&folderName=Tpl&overwriteExisting=true&prune=true");
  });

  it("previews the rename call with a placeholder until a new username is typed", () => {
    expect(renameUserCommand(USER, { newUsername: "", force: false, fromStep: "" }))
      .toBe("curl -XPOST /users/bob@example.com/rename/{newUser}?action=rename");
  });

  it("previews the rename call with its options", () => {
    expect(renameUserCommand(USER, { newUsername: "alice@example.com", force: true, fromStep: "MAILBOX" }))
      .toBe("curl -XPOST /users/bob@example.com/rename/alice@example.com?action=rename&force&fromStep=MAILBOX");
  });

  it("previews the delete user data call, with its step when given", () => {
    expect(deleteUserDataCommand(USER, "")).toBe("curl -XPOST /users/bob@example.com?action=deleteData");
    expect(deleteUserDataCommand(USER, "VacationStep")).toBe("curl -XPOST /users/bob@example.com?action=deleteData&fromStep=VacationStep");
  });

  it("previews the restore call with its body", () => {
    const request = buildRestoreRequest([{ fieldName: "subject", operator: "contains", value: "hi" }], 10);
    expect(restoreDeletedMessagesCommand(USER, request)).toBe(
      `curl -XPOST /deletedMessages/users/bob@example.com?action=restore -d '{"combinator":"and","criteria":[{"fieldName":"subject","operator":"contains","value":"hi"}],"limit":10}'`
    );
  });

  it("omits the restore limit when none is set", () => {
    expect(buildRestoreRequest([], undefined)).toEqual({ combinator: "and", criteria: [] });
  });
});
