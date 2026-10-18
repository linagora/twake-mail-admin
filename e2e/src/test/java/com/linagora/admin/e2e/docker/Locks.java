package com.linagora.admin.e2e.docker;

/**
 * {@code @ResourceLock} keys of the state a backend holds globally, which the per test domain or
 * user cannot isolate. A class driving one of them takes the lock, so that no other class
 * touching the same state runs at the same time:
 *
 * <pre>
 * &#64;ResourceLock(Locks.MAIL_GLOBAL_QUOTA)
 * class GlobalQuotaTest extends MailAdminE2ETest { ... }
 * </pre>
 *
 * Reading such state does not need the lock as long as the test asserts on what it created
 * itself (its own task, its own repository) rather than on absolute counts.
 */
public final class Locks {
    /** {@code /quota} of tmail-backend: the global quota, the default of every user. */
    public static final String MAIL_GLOBAL_QUOTA = "mail-global-quota";
    /** The task list of tmail-backend, when a test asserts on the list as a whole or cancels tasks. */
    public static final String MAIL_TASKS = "mail-tasks";
    /** Event dead letters of tmail-backend, and the health check they degrade. */
    public static final String MAIL_DEAD_LETTERS = "mail-dead-letters";
    /** Mail repositories of tmail-backend (shared, server wide). */
    public static final String MAIL_REPOSITORIES = "mail-repositories";
    /** Server wide maintenance tasks of tmail-backend (all users cleanup, GC, reindex...). */
    public static final String MAIL_SERVER_TASKS = "mail-server-tasks";
    /** The task list of the side service, when a test asserts on the list as a whole. */
    public static final String CALENDAR_TASKS = "calendar-tasks";
    /** Server wide tasks of the side service (archival of every user, LDAP import...). */
    public static final String CALENDAR_SERVER_TASKS = "calendar-server-tasks";
    /** Unsent mails of the side service. */
    public static final String CALENDAR_UNSENT_MAILS = "calendar-unsent-mails";

    private Locks() {
    }
}
