import { describe, expect, it } from "vitest";
import { ADDRESS_BOOK_RIGHTS, SHARE_ACCESS_NO_ACCESS, rightToShareAccess, shareAccessToRight } from "./address-book-share-access";

describe("address book share access codes", () => {
  it("maps each right to the code expected by the DAV server", () => {
    expect(rightToShareAccess("read")).toBe(2);
    expect(rightToShareAccess("read-write")).toBe(3);
    expect(rightToShareAccess("administration")).toBe(5);
  });

  it("revokes with the 'no access' code, never with a right code", () => {
    expect(SHARE_ACCESS_NO_ACCESS).toBe(4);
    expect(ADDRESS_BOOK_RIGHTS.map(rightToShareAccess)).not.toContain(SHARE_ACCESS_NO_ACCESS);
  });

  it("reads back the right of a sharee", () => {
    expect(shareAccessToRight(2)).toBe("read");
    expect(shareAccessToRight(3)).toBe("read-write");
    expect(shareAccessToRight(5)).toBe("administration");
  });

  it("has no right for the codes that are not a delegation", () => {
    // 0 = not shared, 1 = share owner, 4 = no access.
    expect(shareAccessToRight(0)).toBeNull();
    expect(shareAccessToRight(1)).toBeNull();
    expect(shareAccessToRight(SHARE_ACCESS_NO_ACCESS)).toBeNull();
  });

  it("round trips every right", () => {
    ADDRESS_BOOK_RIGHTS.forEach((right) => expect(shareAccessToRight(rightToShareAccess(right))).toBe(right));
  });
});
