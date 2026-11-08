package folio;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Optional event sending to PostHog. Turned on by setting POSTHOG_KEY (project token).
 * POSTHOG_HOST defaults to https://eu.i.posthog.com. Without a key, events are only printed to the console.
 */
public final class Tracker {
    private Tracker() {}

    private static final String KEY = System.getenv("POSTHOG_KEY");
    private static final String HOST = System.getenv().getOrDefault("POSTHOG_HOST", "https://eu.i.posthog.com");
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    /** Person name given with --user (e.g. "ana_zirij"); null means the profile's default person. */
    private static String user;
    private static String userName;

    public static boolean enabled() { return KEY != null && !KEY.isBlank(); }

    /** All following events go to a new person folio_<name>, regardless of the profile. */
    public static void setUser(String name) {
        if (name == null || name.isBlank()) return;
        userName = name.trim();
        user = java.text.Normalizer.normalize(userName, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (user.isEmpty()) user = null;
    }

    public static String distinctId(Model.Profile p) {
        return "folio_" + (user != null ? user : p.id);
    }

    public static void identify(Model.Profile p) {
        Map<String, Object> set = new LinkedHashMap<>();
        set.put("name", userName != null ? userName : p.name);
        set.put("role", p.role);
        set.put("title", p.title);
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("$set", set);
        send("$identify", p, props);
    }

    public static void track(String event, Model.Profile p, Object... kv) {
        Map<String, Object> props = new LinkedHashMap<>();
        for (int k = 0; k + 1 < kv.length; k += 2) props.put(String.valueOf(kv[k]), kv[k + 1]);
        props.put("role", p.role);
        props.put("app", "folio-pdf-demo");
        send(event, p, props);
    }

    private static void send(String event, Model.Profile p, Map<String, Object> props) {
        String distinctId = distinctId(p);
        if (!enabled()) {
            System.out.println("[event] " + event + " · " + distinctId + " · " + props);
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("api_key", KEY);
        body.put("event", event);
        body.put("distinct_id", distinctId);
        body.put("properties", props);
        body.put("timestamp", Instant.now().toString());
        HttpRequest req = HttpRequest.newBuilder(URI.create(HOST + "/i/v0/e/"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)))
                .build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.discarding())
                .exceptionally(ex -> { System.err.println("PostHog: " + ex.getMessage()); return null; });
    }
}
