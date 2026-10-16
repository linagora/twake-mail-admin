import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { toErrorMessage } from "@/components/custom/error-message";
import { decodeBlobErrorBody } from "./blob-error-body";

const axiosErrorWithData = (data: unknown) =>
  new AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404,
    statusText: "Not Found",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });

const rejectionOf = async (error: unknown): Promise<unknown> =>
  decodeBlobErrorBody(error).catch((rejected: unknown) => rejected);

describe("decodeBlobErrorBody", () => {
  it("exposes the WebAdmin message of a JSON Blob body", async () => {
    const body = { statusCode: 404, type: "notFound", message: "Address book does not exist", details: null };
    const error = axiosErrorWithData(new Blob([JSON.stringify(body)], { type: "application/json" }));

    const rejected = await rejectionOf(error);

    expect(rejected).toBe(error);
    expect(toErrorMessage(rejected)).toEqual({ message: "Address book does not exist" });
  });

  it("keeps a plain text Blob body as text", async () => {
    const error = axiosErrorWithData(new Blob(["Internal failure"], { type: "text/plain" }));

    expect(toErrorMessage(await rejectionOf(error))).toEqual({ message: "Internal failure" });
  });

  it("falls back to the Axios message for an empty Blob body", async () => {
    const error = axiosErrorWithData(new Blob([]));

    expect(toErrorMessage(await rejectionOf(error))).toEqual({
      message: "Request failed with status code 404",
    });
  });

  it("leaves non Blob bodies untouched", async () => {
    const body = { message: "User not found" };
    const error = axiosErrorWithData(body);

    await rejectionOf(error);

    expect(error.response?.data).toBe(body);
  });

  it("rejects non Axios errors unchanged", async () => {
    const error = new Error("boom");

    expect(await rejectionOf(error)).toBe(error);
  });
});
