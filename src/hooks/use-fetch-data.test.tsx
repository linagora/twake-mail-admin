// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
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
});
