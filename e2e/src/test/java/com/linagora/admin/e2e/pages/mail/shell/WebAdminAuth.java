package com.linagora.admin.e2e.pages.mail.shell;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.options.AriaRole;

/**
 * Makes the WebAdmin of the Mail stack require a Bearer token, for the browser of one test only:
 * the shared stack has no authentication, so every call without {@code Authorization: Bearer
 * <token>} is answered 401, as a JWT protected WebAdmin does. Also the token prompt of the app
 * ("Authentication Required") and the {@code bearer_token} entry of sessionStorage it keeps the token in.
 */
public final class WebAdminAuth {
    public static final String STORAGE_KEY = "bearer_token";
    private static final String WEBADMIN = "http://webadmin-mail/**";

    private WebAdminAuth() {
    }

    /**
     * Answers 401 to every WebAdmin call of {@code context} (CORS preflights aside) whose
     * Authorization header is not {@code Bearer token}, lets the others through.
     *
     * @return the Authorization header of every call, in order ("" when absent)
     */
    public static List<String> requireToken(BrowserContext context, String token) {
        List<String> authorizations = new CopyOnWriteArrayList<>();
        context.route(WEBADMIN, route -> {
            if (route.request().method().equals("OPTIONS")) {
                route.fallback();
                return;
            }
            String authorization = route.request().headers().getOrDefault("authorization", "");
            authorizations.add(authorization);
            if (authorization.equals("Bearer " + token)) {
                route.fallback();
            } else {
                route.fulfill(new Route.FulfillOptions().setStatus(401)
                    .setHeaders(Map.of("Content-Type", "application/json", "Access-Control-Allow-Origin", "*"))
                    .setBody("{\"statusCode\":401,\"type\":\"InvalidArgument\",\"message\":\"No valid token\"}"));
            }
        });
        return authorizations;
    }

    /** The token prompt. */
    public static Locator dialog(Page page) {
        return page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Authentication Required"));
    }

    public static Locator tokenField(Page page) {
        return dialog(page).getByLabel("Bearer Token", new Locator.GetByLabelOptions().setExact(true));
    }

    public static Locator button(Page page, String name) {
        return dialog(page).getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name).setExact(true));
    }

    /** Types {@code token} in the prompt and clicks Authenticate. */
    public static void authenticate(Page page, String token) {
        tokenField(page).fill(token);
        button(page, "Authenticate").click();
    }

    /** The token held in the sessionStorage of {@code page}, or null when there is none. */
    public static String storedToken(Page page) {
        return (String) page.evaluate("key => sessionStorage.getItem(key)", STORAGE_KEY);
    }

    /** Makes every page of {@code page} start with {@code token} held, as a previous sign in would leave it. */
    public static void holdToken(Page page, String token) {
        page.addInitScript("sessionStorage.setItem('" + STORAGE_KEY + "', '" + token + "')");
    }
}
