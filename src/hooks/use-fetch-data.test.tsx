// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

describe("useFetchData status", () => {
  const rejectWith = (status: number) => () =>
    Promise.reject(new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, undefined, {
      status, statusText: "", headers: {}, config: {}, data: {},
    } as AxiosResponse));

  it("reports the HTTP status of a failure", async () => {
    const getter = rejectWith(404);
    const { result } = renderHook(() => useFetchData(getter));
    await waitFor(() => expect(result.current.status).toBe(404));
  });

  it("has no status for a failure without response, nor once loaded", async () => {
    const { result } = renderHook(() => useFetchData(failingGetter));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.status).toBeNull();

    const ok = () => Promise.resolve(1);
    const { result: loaded } = renderHook(() => useFetchData(ok));
    await waitFor(() => expect(loaded.current.data).toBe(1));
    expect(loaded.current.status).toBeNull();
  });
});

describe("useFetchData refreshes", () => {
  it("keeps the data on screen without a loading state on a silent refresh", async () => {
    let resolveSecond: (value: number) => void = () => {};
    const getter = vi.fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const { result } = renderHook(() => useFetchData(getter));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => { result.current.refreshSilently(); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(1);

    await act(async () => resolveSecond(2));
    expect(result.current.data).toBe(2);
  });

  it("ignores an earlier request answering after a later one", async () => {
    const resolvers: ((value: string) => void)[] = [];
    const getter = vi.fn(() => new Promise<string>((resolve) => { resolvers.push(resolve); }));
    const { result } = renderHook(() => useFetchData(getter));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    act(() => { result.current.refresh(); });
    await act(async () => resolvers[1]("latest"));
    await act(async () => resolvers[0]("stale"));

    expect(result.current.data).toBe("latest");
    expect(result.current.isLoading).toBe(false);
  });
});
