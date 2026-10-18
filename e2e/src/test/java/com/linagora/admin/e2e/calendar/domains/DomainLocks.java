package com.linagora.admin.e2e.calendar.domains;

/** {@code @ResourceLock} keys of this package. */
final class DomainLocks {
    /**
     * Domain contacts and domain tasks of open-paas.org, the only domain the side service serves,
     * shared by every test: the classes acting on them do not run at the same time.
     */
    static final String OPEN_PAAS = "calendar-domain-open-paas";

    private DomainLocks() {
    }
}
