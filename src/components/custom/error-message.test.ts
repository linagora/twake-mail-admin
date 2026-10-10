import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { toErrorMessage } from "./error-message";

const axiosErrorWithData = (data: unknown) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });

describe("toErrorMessage", () => {
  it("uses the WebAdmin message and details", () => {
    const error = axiosErrorWithData({
      statusCode: 400,
      type: "InvalidArgument",
      message: "The target forward is not an email address",
      details: "Invalid character in local-part",
    });

    expect(toErrorMessage(error)).toEqual({
      message: "The target forward is not an email address",
      details: "Invalid character in local-part",
    });
  });

  it("omits details when WebAdmin does not provide them", () => {
    const error = axiosErrorWithData({ statusCode: 404, message: "User not found" });

    expect(toErrorMessage(error)).toEqual({ message: "User not found", details: undefined });
  });

  it("uses a plain text response body", () => {
    expect(toErrorMessage(axiosErrorWithData("Bad gateway"))).toEqual({ message: "Bad gateway" });
  });

  it("falls back to the Axios message when the body carries no message", () => {
    expect(toErrorMessage(axiosErrorWithData({ statusCode: 500 }))).toEqual({
      message: "Request failed with status code 400",
    });
  });

  it("falls back to the Axios message without response", () => {
    const error = new AxiosError("Network Error", "ERR_NETWORK");

    expect(toErrorMessage(error)).toEqual({ message: "Network Error" });
  });

  it("uses the message of a plain Error", () => {
    expect(toErrorMessage(new Error("boom"))).toEqual({ message: "boom" });
  });

  it("uses string errors as is", () => {
    expect(toErrorMessage("boom")).toEqual({ message: "boom" });
  });

  it("serializes other values", () => {
    expect(toErrorMessage({ code: 42 })).toEqual({ message: '{"code":42}' });
  });
});
