package com.linagora.admin.e2e.pages.calendar.ops;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import java.util.regex.Pattern;

import com.linagora.admin.e2e.pages.AdminApp;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.SelectOption;

/** The expanded Booking Links section of a user, and its Create / Edit dialogs. */
public class BookingLinksSection {
    private final AdminApp app;

    BookingLinksSection(AdminApp app) {
        this.app = app;
    }

    public Locator createButton() {
        return app.button("Create booking link");
    }

    /** The row of a link, by the text of its public ID. */
    public Locator row(String publicId) {
        return app.main().getByText(publicId, new Locator.GetByTextOptions().setExact(true))
            .locator("xpath=ancestor::div[.//button[@title='Delete booking link']][1]");
    }

    public Locator rowAction(String publicId, String title) {
        return row(publicId).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(title).setExact(true));
    }

    public Form openCreate() {
        createButton().click();
        return new Form(app);
    }

    public Form openEdit(String publicId) {
        rowAction(publicId, "Edit booking link").click();
        return new Form(app);
    }

    public Form openDuplicate(String publicId) {
        rowAction(publicId, "Duplicate booking link").click();
        return new Form(app);
    }

    /** The Create / Edit booking link dialog. */
    public static class Form {
        private final AdminApp app;

        Form(AdminApp app) {
            this.app = app;
            assertThat(root()).isVisible();
        }

        public Locator root() {
            return app.dialog();
        }

        /** The calendar dropdown: "Calendar *" when creating, "Calendar" when editing. */
        public Locator calendar() {
            return root().getByLabel(Pattern.compile("^Calendar( \\*)?$"));
        }

        public Locator calendarOptions() {
            return calendar().locator("option");
        }

        public Form selectCalendar(String label) {
            calendar().selectOption(new SelectOption().setLabel(label));
            return this;
        }

        public Locator name() {
            return root().getByLabel("Name", new Locator.GetByLabelOptions().setExact(true));
        }

        public Locator description() {
            return root().getByLabel("Description", new Locator.GetByLabelOptions().setExact(true));
        }

        public Locator duration() {
            return root().getByLabel(Pattern.compile("^Duration \\(minutes\\)"));
        }

        public Locator durationError() {
            return root().getByText("Enter a whole number of minutes, 1 or more.");
        }

        public Locator active() {
            return root().getByLabel("Active", new Locator.GetByLabelOptions().setExact(true));
        }

        public Locator autoAccept() {
            return root().getByRole(AriaRole.CHECKBOX, new Locator.GetByRoleOptions().setName(Pattern.compile("^Auto-accept bookings")));
        }

        public Locator color() {
            return root().getByLabel("Color", new Locator.GetByLabelOptions().setExact(true));
        }

        public Locator day(int rule) {
            return root().getByLabel("Day", new Locator.GetByLabelOptions().setExact(true)).nth(rule);
        }

        public Locator start(int rule) {
            return root().getByLabel("Start time", new Locator.GetByLabelOptions().setExact(true)).nth(rule);
        }

        public Locator end(int rule) {
            return root().getByLabel("End time", new Locator.GetByLabelOptions().setExact(true)).nth(rule);
        }

        public Locator timeZone(int rule) {
            return root().getByLabel("Time zone", new Locator.GetByLabelOptions().setExact(true)).nth(rule);
        }

        public Locator button(String name) {
            return root().getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
        }

        public Locator create() {
            return button("Create");
        }

        public Locator save() {
            return button("Save");
        }

        public void cancel() {
            button("Cancel").click();
            assertThat(root()).isHidden();
        }
    }
}
