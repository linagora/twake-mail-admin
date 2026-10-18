package com.linagora.admin.e2e.pages.mail.shell;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.List;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;

/** The Health Check page: one card per component, grouped under section headings. */
public class HealthCheckPage {
    public static final String TITLE = "Welcome to Twake Mail administration!";
    public static final String STORAGE = "Storage dependencies";
    public static final String CORE = "Core components";
    public static final String RABBITMQ = "RabbitMQ specific checks";
    public static final String OTHER = "Other";

    private final AdminApp app;

    public HealthCheckPage(AdminApp app) {
        this.app = app;
    }

    public static HealthCheckPage open(AdminApp app) {
        app.open("/health-check");
        HealthCheckPage page = new HealthCheckPage(app);
        assertThat(page.title()).isVisible();
        assertThat(page.sectionHeadings().first()).isVisible();
        return page;
    }

    public Locator title() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setName(TITLE).setExact(true));
    }

    public Locator sectionHeadings() {
        return app.main().getByRole(AriaRole.HEADING, new Locator.GetByRoleOptions().setLevel(2))
            .filter(new Locator.FilterOptions().setHasNotText(TITLE));
    }

    public List<String> sectionTitles() {
        return sectionHeadings().allInnerTexts();
    }

    public Locator section(String heading) {
        return app.main().locator("section").filter(new Locator.FilterOptions().setHas(app.page().getByRole(AriaRole.HEADING,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName(heading).setExact(true))));
    }

    /** The component names of a section, in display order. */
    public List<String> componentsOf(String heading) {
        return section(heading).locator(":scope > div > *").allInnerTexts().stream().map(String::trim).toList();
    }

    /** Every component name shown, whatever the section. */
    public List<String> allComponents() {
        return app.main().locator("section > div > *").allInnerTexts().stream().map(String::trim).toList();
    }

    /** The element the user hovers or focuses: the card itself, or its tooltip trigger wrapper. */
    public Locator hoverTarget(String component) {
        return app.main().locator("section > div > *").filter(new Locator.FilterOptions()
            .setHasText(Shell.exactly(component))).first();
    }

    public Locator tooltip() {
        return app.page().getByRole(AriaRole.TOOLTIP);
    }

    /** Computed text colour of a component card. */
    public String textColor(String component) {
        return cardStyle(component, "color");
    }

    /** Computed background colour of a component card. */
    public String backgroundColor(String component) {
        return cardStyle(component, "backgroundColor");
    }

    private String cardStyle(String component, String property) {
        return String.valueOf(hoverTarget(component).evaluate("(e, p) => { const card = e.matches('[tabindex]') ? e.firstElementChild : e;"
            + " return getComputedStyle(card)[p]; }", property));
    }

    /** Computed border colour of a component card, e.g. {@code rgb(22, 163, 74)} or an oklch() value. */
    public String borderColor(String component) {
        return String.valueOf(app.main().locator("section > div > *").filter(new Locator.FilterOptions()
                .setHasText(Shell.exactly(component))).first()
            .evaluate("e => { const card = e.matches('[tabindex]') ? e.firstElementChild : e;"
                + " return getComputedStyle(card).borderTopColor; }"));
    }
}
