package com.linagora.admin.e2e.backend;

import java.util.Hashtable;

import javax.naming.Context;
import javax.naming.NamingException;
import javax.naming.directory.BasicAttribute;
import javax.naming.directory.BasicAttributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;

import com.linagora.admin.e2e.docker.CalendarStack;

/**
 * Seeds the data of one test on the Calendar stack.
 *
 * <p><b>Isolation.</b> The side service only serves {@code open-paas.org}, so the <em>user</em> is
 * the unit of isolation: every account a test asks for is brand new, its calendars, address
 * books and booking links cannot leak into another test. Domains a test creates (domain list,
 * import) get a unique name too.
 */
public class CalendarFixtures {
    public static final String DOMAIN = CalendarStack.DOMAIN;
    public static final String PASSWORD = "secret";

    private final CalendarStack stack;
    private final WebAdmin webAdmin;

    public CalendarFixtures(CalendarStack stack, WebAdmin webAdmin) {
        this.stack = stack;
        this.webAdmin = webAdmin;
    }

    public WebAdmin webAdmin() {
        return webAdmin;
    }

    /**
     * A new registered user: in {@code /users} and in {@code /registeredUsers}, which provisions
     * its default calendar and address books. Its first name and last name are its local part.
     */
    public String newRegisteredUser(String prefix) {
        String address = newUnregisteredUser(prefix);
        register(address);
        return address;
    }

    public String newRegisteredUser() {
        return newRegisteredUser("user");
    }

    /** A new user of {@code /users} only, not registered as a calendar user. */
    public String newUnregisteredUser(String prefix) {
        String address = Ids.unique(prefix) + "@" + DOMAIN;
        webAdmin.put("/users/" + address, "{\"password\":\"" + PASSWORD + "\"}").expect(204);
        return address;
    }

    /** Registers an existing user of {@code /users}; returns its id. */
    public String register(String address) {
        String localPart = address.substring(0, address.indexOf('@'));
        String id = Ids.objectId();
        webAdmin.post("/registeredUsers", "{\"email\":\"" + address + "\",\"firstname\":\"" + localPart
            + "\",\"lastname\":\"" + localPart + "\",\"id\":\"" + id + "\"}").expect(201);
        return id;
    }

    /** A new account in LDAP only: neither in {@code /users} nor registered. */
    public String newLdapUser(String prefix) {
        String uid = Ids.unique(prefix).replace('-', '_');
        BasicAttributes attributes = new BasicAttributes(true);
        BasicAttribute objectClass = new BasicAttribute("objectClass");
        objectClass.add("inetOrgPerson");
        attributes.put(objectClass);
        attributes.put("uid", uid);
        attributes.put("cn", uid);
        attributes.put("sn", uid);
        attributes.put("givenName", uid);
        attributes.put("mail", uid + "@" + DOMAIN);
        attributes.put("userPassword", PASSWORD);
        DirContext context = ldap();
        try {
            context.createSubcontext("uid=" + uid + ",ou=users,dc=open-paas.org,dc=lng", attributes).close();
        } catch (NamingException e) {
            throw new IllegalStateException("Could not create " + uid + " in LDAP", e);
        } finally {
            close(context);
        }
        return uid + "@" + DOMAIN;
    }

    /** A new domain of WebAdmin, with a unique name: {@code d-k3x9q2.e2e.test}. */
    public String newDomain(String prefix) {
        String name = Ids.unique(prefix) + ".e2e.test";
        webAdmin.put("/domains/" + name).expect(204);
        return name;
    }

    private DirContext ldap() {
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        env.put(Context.PROVIDER_URL, stack.ldapUrl());
        env.put(Context.SECURITY_AUTHENTICATION, "simple");
        env.put(Context.SECURITY_PRINCIPAL, "cn=admin,dc=open-paas.org,dc=lng");
        env.put(Context.SECURITY_CREDENTIALS, "admin");
        try {
            return new InitialDirContext(env);
        } catch (NamingException e) {
            throw new IllegalStateException("LDAP unreachable at " + stack.ldapUrl(), e);
        }
    }

    private static void close(DirContext context) {
        try {
            context.close();
        } catch (NamingException e) {
            // nothing to do
        }
    }
}
