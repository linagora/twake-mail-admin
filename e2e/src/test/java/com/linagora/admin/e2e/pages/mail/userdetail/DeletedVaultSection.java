package com.linagora.admin.e2e.pages.mail.userdetail;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The "Deleted Message Vault" section of a user detail page. */
public class DeletedVaultSection {
    private final MailUserDetailPage detail;

    DeletedVaultSection(MailUserDetailPage detail) {
        this.detail = detail;
    }

    public DeletedVaultSection open() {
        detail.sectionToggle("Deleted Message Vault").click();
        assertThat(searchButton()).isVisible();
        return this;
    }

    public CriteriaBuilder criteria() {
        return new CriteriaBuilder(detail.page(), detail.main());
    }

    public Locator searchButton() {
        return detail.button("Search");
    }

    /** The "Restore" button of the criteria (the result rows have their own "Restore" action, after it). */
    public Locator restoreButton() {
        return detail.button("Restore").first();
    }

    /** The per row "Restore" action of the result showing {@code subject}. */
    public Locator restoreRow(String subject) {
        return table().getByRole(AriaRole.ROW).filter(new Locator.FilterOptions().setHasText(subject))
            .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Restore").setExact(true));
    }

    public Locator found() {
        return detail.main().getByText(Pattern.compile("^\\d+ message\\(s\\) found"));
    }

    public Locator table() {
        return detail.main().getByRole(AriaRole.TABLE);
    }
}
