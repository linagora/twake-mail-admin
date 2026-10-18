package com.linagora.admin.e2e.pages;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Entry point of the page objects: the admin app shell (sidebar, toasts, confirmation dialog),
 * common to the Mail and the Calendar flavours.
 *
 * <p><b>Locate by role and accessible name</b> ({@code getByRole}, {@code getByLabel}, visible
 * text), never by CSS class: the app is built with shadcn + tailwind, whose classes are styling,
 * not identity. Prefer {@code PlaywrightAssertions.assertThat(locator)}: it retries until the
 * timeout, so it does not race the rendering.
 */
public class AdminApp {
    private final Page page;

    public AdminApp(Page page) {
        this.page = page;
    }

    public Page page() {
        return page;
    }

    /** Opens a route of the app, {@code "/"} or {@code "/users/user/bob%40example.com"}, and waits for the shell. */
    public AdminApp open(String path) {
        page.navigate(path);
        assertThat(sidebar()).isVisible();
        return this;
    }

    public Locator sidebar() {
        return page.locator("[data-sidebar=sidebar]").first();
    }

    /** Clicks an entry of the sidebar, by its visible name ("Users", "Domains"...). */
    public AdminApp navigate(String entry) {
        sidebar().getByRole(AriaRole.LINK, new Locator.GetByRoleOptions().setName(entry).setExact(true)).click();
        return this;
    }

    public Locator main() {
        return page.locator("main");
    }

    /** The title of the current page. */
    public Locator heading() {
        return main().getByRole(AriaRole.HEADING).first();
    }

    public Locator button(String name) {
        return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(name).setExact(true));
    }

    /** The open dialog: confirmation, task parameters, details... */
    public Locator dialog() {
        return page.getByRole(AriaRole.DIALOG);
    }

    /** Clicks "Confirm" in the open dialog and waits for it to close. */
    public AdminApp confirm() {
        dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Confirm").setExact(true)).click();
        assertThat(dialog()).isHidden();
        return this;
    }

    /** Clicks "Confirm" in the open dialog without expecting it to close (validation, refusal). */
    public AdminApp clickConfirm() {
        dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Confirm").setExact(true)).click();
        return this;
    }

    public AdminApp cancel() {
        dialog().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Cancel").setExact(true)).click();
        assertThat(dialog()).isHidden();
        return this;
    }

    /** The error shown inside the open dialog. */
    public Locator dialogError() {
        return dialog().getByRole(AriaRole.ALERT);
    }

    /** The toasts region ("Notifications"). */
    public Locator toasts() {
        return page.getByRole(AriaRole.REGION, new Page.GetByRoleOptions().setName(Pattern.compile("Notifications")));
    }

    /** A toast containing {@code text}. Toasts vanish after a few seconds: assert right after the action. */
    public Locator toast(String text) {
        return toasts().getByRole(AriaRole.STATUS).filter(new Locator.FilterOptions().setHasText(text))
            .or(toasts().locator("li").filter(new Locator.FilterOptions().setHasText(text))).first();
    }

    public AdminApp expectToast(String text) {
        assertThat(toast(text)).isVisible();
        return this;
    }

    /** A collapsible section of a detail page, by its title: opens it if it is collapsed. */
    public Locator section(String title) {
        return main().getByText(title, new Locator.GetByTextOptions().setExact(true)).first();
    }
}
