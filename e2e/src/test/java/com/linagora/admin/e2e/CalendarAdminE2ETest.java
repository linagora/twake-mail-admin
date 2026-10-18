package com.linagora.admin.e2e;

import org.junit.jupiter.api.extension.ExtendWith;

import com.linagora.admin.e2e.docker.AdminE2EExtension;
import com.linagora.admin.e2e.docker.Application;
import com.linagora.admin.e2e.docker.UsesStack;

/**
 * Base class of the tests of Twake Calendar Admin ({@code APPLICATION=CALENDAR}), over the
 * twake-calendar side service.
 *
 * <p>Declare what a test needs as method parameters: {@code AdminApp}, {@code CalendarFixtures}
 * (its own users), {@code WebAdmin}, {@code Page}... see {@link AdminE2EExtension}.
 */
@ExtendWith(AdminE2EExtension.class)
@UsesStack(Application.CALENDAR)
public abstract class CalendarAdminE2ETest {
}
