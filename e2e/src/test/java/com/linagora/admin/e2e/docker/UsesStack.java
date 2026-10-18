package com.linagora.admin.e2e.docker;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Which stack the tests of a class drive: see {@code MailAdminE2ETest}, {@code CalendarAdminE2ETest}. */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Inherited
public @interface UsesStack {
    Application value();
}
