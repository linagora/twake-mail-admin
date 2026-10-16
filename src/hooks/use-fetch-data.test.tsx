// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosResponse } from "axios";
import i18n from "@/i18n";
import { useFetchData } from "./use-fetch-data";

const failingGetter = () => Promise.reject(new Error("Request failed with status code 404"));

describe("useFetchData", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("reports the load failure in the current language", async () => {
    const { result } = renderHook(() => useFetchData(failingGetter));

    await waitFor(() =>
      expect(result.current.error).toBe("Échec du chargement des données : Request failed with status code 404")
    );
  });

  it("reports WebAdmin's message and details rather than the generic Axios message", async () => {
    const getter = () =>
      Promise.reject(
        new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 400,
          data: { message: "Invalid task id", details: "Invalid UUID string: does-not-exist" },
        } as AxiosResponse)
      );

    const { result } = renderHook(() => useFetchData(getter));

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Échec du chargement des données : Invalid task id — Invalid UUID string: does-not-exist"
      )
    );
  });

  it("reports a plain text WebAdmin answer rather than the generic Axios message", async () => {
    const getter = () =>
      Promise.reject(
        new AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 404,
          data: "00000000-0000-0000-0000-000000000000 can not be found",
        } as AxiosResponse)
      );

    const { result } = renderHook(() => useFetchData(getter));

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Échec du chargement des données : 00000000-0000-0000-0000-000000000000 can not be found"
      )
    );
  });

  it("drops the previous data when a refresh fails", async () => {
    let shouldFail = false;
    const getter = async () => {
      if (shouldFail) throw new Error("Request failed with status code 400");
      return ["previous"];
    };

    const { result } = renderHook(() => useFetchData(getter));
    await waitFor(() => expect(result.current.data).toEqual(["previous"]));

    shouldFail = true;
    await act(() => result.current.refresh());

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Échec du chargement des données : Request failed with status code 400");
  });

  it("translates the displayed load failure again when the language changes", async () => {
    const { result } = renderHook(() => useFetchData(failingGetter));
    await waitFor(() =>
      expect(result.current.error).toBe("Échec du chargement des données : Request failed with status code 404")
    );

    await act(() => i18n.changeLanguage("en"));

    try {
      expect(result.current.error).toBe("Failed to fetch data: Request failed with status code 404");
    } finally {
      await act(() => i18n.changeLanguage("fr"));
    }
  });
});
