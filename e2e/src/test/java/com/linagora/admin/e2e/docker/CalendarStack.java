package com.linagora.admin.e2e.docker;

/**
 * The Calendar stack: the admin app ({@code APPLICATION=CALENDAR}) over the twake-calendar side
 * service, see {@code docker-calendar-e2e.yml}. Addressing works as in {@link MailStack}:
 * {@code http://localhost:8097} is the admin app, {@code http://webadmin-calendar} the WebAdmin of
 * the side service.
 *
 * <p>The side service only knows the domain {@code open-paas.org} (configuration.properties):
 * the accounts of the tests are created there, see {@code CalendarFixtures}.
 */
public class CalendarStack extends ComposeStack {
    public static final String ADMIN_URL = "http://localhost:8097";
    public static final String BACKEND = "twake-calendar-side-service";
    public static final String DOMAIN = "open-paas.org";

    private static volatile CalendarStack instance;

    public static CalendarStack singleton() {
        CalendarStack local = instance;
        if (local == null) {
            synchronized (CalendarStack.class) {
                local = instance;
                if (local == null) {
                    local = new CalendarStack();
                    local.start();
                    instance = local;
                }
            }
        }
        return local;
    }

    private CalendarStack() {
        super("calendar", "docker-calendar-e2e.yml");
    }

    @Override
    protected boolean isReady() {
        return httpStatus(webAdminUrl() + "/domains") == 200
            && httpStatus(url("admin", 80) + "/env.js") == 200;
    }

    @Override
    public String hostResolverRules() {
        return String.join(",",
            rule("localhost:8097", "admin", 80),
            rule("webadmin-calendar", BACKEND, 8000),
            rule("mock-smtp", "mock-smtp", 8000));
    }

    @Override
    public String adminUrl() {
        return ADMIN_URL;
    }

    @Override
    public String webAdminUrl() {
        return url(BACKEND, 8000);
    }

    /** REST side of the mock SMTP server: {@code GET /smtpMails} lists what the backend sent. */
    public String mockSmtpUrl() {
        return url("mock-smtp", 8000);
    }

    /** Sabre, the CalDAV / CardDAV server. */
    public String davUrl() {
        return url("sabre_dav", 80);
    }

    public String ldapUrl() {
        return "ldap://127.0.0.1:" + port("ldap", 389);
    }

    public String mongoUri() {
        return "mongodb://127.0.0.1:" + port("mongo", 27017);
    }
}
