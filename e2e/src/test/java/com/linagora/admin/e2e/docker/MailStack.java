package com.linagora.admin.e2e.docker;

/**
 * The Mail stack: the admin app ({@code APPLICATION=MAIL}) over a distributed tmail-backend,
 * see {@code docker-mail-e2e.yml}.
 *
 * <p><b>Addressing.</b> The admin app reads WebAdmin's URL from {@code env.js}, mounted before
 * docker has picked any host port. So the URLs are fixed and the browser is taught to resolve
 * them, through Chromium's {@code --host-resolver-rules}:
 * <ul>
 *   <li>{@code http://localhost:8098}: the admin app. Nothing listens on 8098, the browser remaps it.
 *       A loopback origin is a secure context: clipboard and {@code crypto} work as in production.</li>
 *   <li>{@code http://webadmin-mail}: WebAdmin of tmail-backend, on another origin, as in a real
 *       deployment, which keeps CORS under test.</li>
 * </ul>
 */
public class MailStack extends ComposeStack {
    public static final String ADMIN_URL = "http://localhost:8098";
    public static final String BACKEND = "tmail-backend";

    private static volatile MailStack instance;

    public static MailStack singleton() {
        MailStack local = instance;
        if (local == null) {
            synchronized (MailStack.class) {
                local = instance;
                if (local == null) {
                    local = new MailStack();
                    local.start();
                    instance = local;
                }
            }
        }
        return local;
    }

    private MailStack() {
        super("mail", "docker-mail-e2e.yml");
    }

    @Override
    protected boolean isReady() {
        return httpStatus(webAdminUrl() + "/domains") == 200
            && httpStatus(url("admin", 80) + "/env.js") == 200;
    }

    @Override
    public String hostResolverRules() {
        return String.join(",",
            rule("localhost:8098", "admin", 80),
            rule("webadmin-mail", BACKEND, 8000));
    }

    @Override
    public String adminUrl() {
        return ADMIN_URL;
    }

    @Override
    public String webAdminUrl() {
        return url(BACKEND, 8000);
    }

    /** The SMTP server of tmail-backend, on the host. */
    public int smtpPort() {
        return port(BACKEND, 25);
    }
}
