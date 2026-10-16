// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { SettingRow } from "./calendar-domain-settings";

afterEach(cleanup);

describe("calendar domain settings: field labels", () => {
  it("names each setting select after its visible label", () => {
    render(
      <>
        <SettingRow label="User search mode" defaultLabel="Use system default" value="__default__" options={[]} disabled={false} onChange={() => {}} />
        <SettingRow label="Resource search" defaultLabel="Use system default" value="__default__" options={[]} disabled={false} onChange={() => {}} />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "User search mode" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Resource search" })).toBeTruthy();
  });
});
