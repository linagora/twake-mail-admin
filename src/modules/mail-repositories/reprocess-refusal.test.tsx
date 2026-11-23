// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { describeReprocessRefusal, refusedReprocessParam } from "./reprocess-refusal";

const webAdminAnswer = (status: number, message: string) =>
  new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: status, type: "InvalidArgument", message, details: null },
  });

afterEach(cleanup);

describe("reprocessing refused by WebAdmin", () => {
  it("tells the unknown processor 400 from the unknown queue 400 by their message", () => {
    expect(refusedReprocessParam(webAdminAnswer(400, "'unknown' processor is not configured"))).toBe("processor");
    expect(refusedReprocessParam(webAdminAnswer(400, "'unknown' mail queue does not exist"))).toBe("queue");
  });

  it("leaves any other error to the usual display", () => {
    expect(refusedReprocessParam(webAdminAnswer(400, "Invalid limit"))).toBeNull();
    expect(refusedReprocessParam(webAdminAnswer(500, "'unknown' processor is not configured"))).toBeNull();
    expect(refusedReprocessParam(new Error("'unknown' processor is not configured"))).toBeNull();
    expect(describeReprocessRefusal(webAdminAnswer(404, "The repository does not exist"))).toBeNull();
  });

  it("names the refused processor, says no mail was moved and shows the server message", () => {
    render(<>{describeReprocessRefusal(webAdminAnswer(400, "'unknown' processor is not configured"))}</>);

    expect(screen.getByText("mailRepositories.reprocessRefused.processor")).toBeTruthy();
    expect(screen.getByText("common.serverMessage")).toBeTruthy();
    expect(screen.getByText("'unknown' processor is not configured")).toBeTruthy();
  });
});
