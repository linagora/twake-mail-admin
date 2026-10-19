// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import MailFiltersPanel from "./mail-filters-panel";

afterEach(cleanup);

const NO_FILTER = { sender: "", recipient: "", updatedBefore: "", updatedAfter: "", remoteAddress: "", remoteHost: "" };

describe("mail filters panel", () => {
  it.each([
    ["mailRepositories.filterSender", "alice@domain.org"],
    ["mailRepositories.filterRecipient", "bob@domain.org"],
    ["mailRepositories.filterRemoteAddress", "192.168.1.10"],
    ["mailRepositories.filterRemoteHost", "smtp.external.org"],
    ["mailRepositories.filterUpdatedBefore", "1d, 2h, 30m"],
    ["mailRepositories.filterUpdatedAfter", "7d, 2h, 30m"],
  ])("names the field %s by its visible label", (label, placeholder) => {
    render(<MailFiltersPanel filters={NO_FILTER} onApply={vi.fn()} />);
    fireEvent.click(screen.getByText("mailRepositories.filtersLabel"));

    expect(screen.getByLabelText(label)).toBe(screen.getByPlaceholderText(placeholder));
  });
});
