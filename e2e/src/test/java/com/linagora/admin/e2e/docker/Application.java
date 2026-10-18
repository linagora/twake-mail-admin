package com.linagora.admin.e2e.docker;

/** The two flavours of the admin app under test, each over its own backend stack. */
public enum Application {
    MAIL,
    CALENDAR;

    public ComposeStack stack() {
        return switch (this) {
            case MAIL -> MailStack.singleton();
            case CALENDAR -> CalendarStack.singleton();
        };
    }
}
