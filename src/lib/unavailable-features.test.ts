// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { apiClient } from "./apiClient";
import { isFeatureUnavailable, markFeatureUnavailable, useFeatureUnavailable } from "./unavailable-features";

beforeEach(() => {
  sessionStorage.clear();
  apiClient.defaults.baseURL = "https://webadmin.example.com";
});

describe("unavailable features", () => {
  it("is available until found missing", () => {
    expect(isFeatureUnavailable("messageSearch")).toBe(false);
  });

  it("remembers a missing feature for the browser session", () => {
    markFeatureUnavailable("messageSearch");

    expect(isFeatureUnavailable("messageSearch")).toBe(true);
    expect(sessionStorage.getItem("twake-admin.messageSearchUnavailable")).toBe("https://webadmin.example.com");
    expect(isFeatureUnavailable("signatureTemplates")).toBe(false);
  });

  it("forgets it on another WebAdmin base URL", () => {
    markFeatureUnavailable("messageSearch");
    apiClient.defaults.baseURL = "https://other.example.com";

    expect(isFeatureUnavailable("messageSearch")).toBe(false);
  });

  it("tells the rendered components as soon as it is found missing", () => {
    const { result } = renderHook(() => useFeatureUnavailable("signatureTemplates"));
    expect(result.current).toBe(false);

    act(() => markFeatureUnavailable("signatureTemplates"));

    expect(result.current).toBe(true);
  });
});
