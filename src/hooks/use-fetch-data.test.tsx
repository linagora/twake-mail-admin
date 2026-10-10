// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
});
