package com.linagora.admin.e2e;

import org.junit.jupiter.api.extension.ExtendWith;

import com.linagora.admin.e2e.docker.AdminE2EExtension;
import com.linagora.admin.e2e.docker.Application;
import com.linagora.admin.e2e.docker.UsesStack;

/**
 * Base class of the tests of Twake Mail Admin ({@code APPLICATION=MAIL}), over tmail-backend.
 *
 * <p>Declare what a test needs as method parameters: {@code AdminApp}, {@code MailFixtures} (its
 * own domain and users), {@code WebAdmin}, {@code Page}... see {@link AdminE2EExtension}.
 */
@ExtendWith(AdminE2EExtension.class)
@UsesStack(Application.MAIL)
public abstract class MailAdminE2ETest {
}
