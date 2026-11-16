import { describe, expect, it } from "vitest";
import { isMissingRoute } from "./missing-route";

const notFound = (message?: string) => ({ response: { status: 404, data: { message } } });

describe("missing route", () => {
  it("recognises the 404 WebAdmin answers for a route it does not have", () => {
    expect(isMissingRoute(notFound("POST /users/bob%40example.com/mails can not be found"))).toBe(true);
    expect(isMissingRoute(notFound("GET /domains/example.com/signature-templates can not be found"))).toBe(true);
  });

  it("does not take the 404 of an unknown user or domain for a missing route", () => {
    expect(isMissingRoute(notFound("User 'ghost@example.com' does not exist"))).toBe(false);
    expect(isMissingRoute(notFound())).toBe(false);
  });

  it("only applies to 404", () => {
    expect(isMissingRoute({ response: { status: 500, data: { message: "GET /x can not be found" } } })).toBe(false);
    expect(isMissingRoute(new Error("Network Error"))).toBe(false);
    expect(isMissingRoute(null)).toBe(false);
  });
});
