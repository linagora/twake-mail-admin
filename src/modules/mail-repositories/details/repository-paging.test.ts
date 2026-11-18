import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import { hasActiveFilter, lastPageAction, pagingLabel, repositoryPaging } from "./repository-paging";

const t = ((key: string, options?: Record<string, unknown>) =>
  `${key} ${JSON.stringify(options)}`) as unknown as TFunction;

const noFilter = {
  sender: "", recipient: "", updatedBefore: "", updatedAfter: "", remoteAddress: "", remoteHost: "",
};

describe("repository paging", () => {
  it("detects an active filter", () => {
    expect(hasActiveFilter(noFilter)).toBe(false);
    expect(hasActiveFilter({ ...noFilter, sender: "qa@example.com" })).toBe(true);
  });

  it("counts the whole repository without a filter", () => {
    const paging = repositoryPaging({ page: 1, limit: 2, repositorySize: 3, listed: 2, filtered: false });

    expect(paging).toEqual({ hasMore: true, total: 3, totalPages: 2 });
    expect(pagingLabel(t, 1, paging)).toBe('common.page {"page":1,"totalPages":2,"total":3}');
  });

  it("counts only the listed mails with a filter, not the whole repository", () => {
    const paging = repositoryPaging({ page: 1, limit: 200, repositorySize: 3, listed: 0, filtered: true });

    expect(paging).toEqual({ hasMore: false, total: 0 });
    expect(pagingLabel(t, 1, paging)).toBe('common.pageOf {"page":1,"count":0}');
  });

  it("offers a next page after a full filtered page, whatever the repository size", () => {
    const paging = repositoryPaging({ page: 1, limit: 2, repositorySize: 1, listed: 2, filtered: true });

    expect(paging.hasMore).toBe(true);
    expect(pagingLabel(t, 1, paging)).toBe('common.pageOf {"page":1,"count":2}+');
  });

  it("offers no last page when the number of pages is unknown", () => {
    const goToPage = vi.fn();

    expect(lastPageAction({ hasMore: true, total: 2 }, goToPage)).toBeUndefined();
    lastPageAction({ hasMore: true, total: 3, totalPages: 2 }, goToPage)!();
    expect(goToPage).toHaveBeenCalledWith(2);
  });
});
