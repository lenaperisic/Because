package folio;

import java.awt.Color;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Podaci PDF alata: profil, dokumenti i koliko je koja funkcija korišćena. Čuva se u folio-data/&lt;id&gt;.json. */
public final class Model {
    private Model() {}

    public static final String[] PROFILE_IDS = { "developer", "lekar", "bankar" };

    /** Funkcije alata: id, naziv i ikonica. Redosled je redosled u traci sa alatima. */
    public static final class Feature {
        public final String id, name;
        public final Widgets.Icon icon;

        Feature(String id, String name, Widgets.Icon icon) { this.id = id; this.name = name; this.icon = icon; }
    }

    public static final List<Feature> FEATURES = List.of(
            new Feature("read", "Čitanje", Widgets.Icon.EYE),
            new Feature("search", "Pretraga", Widgets.Icon.SEARCH),
            new Feature("annotate", "Komentar", Widgets.Icon.COMMENT),
            new Feature("sign", "Potpis", Widgets.Icon.SIGN),
            new Feature("fill_form", "Formular", Widgets.Icon.FORM),
            new Feature("ocr", "OCR", Widgets.Icon.SCAN),
            new Feature("redact", "Zacrni", Widgets.Icon.REDACT),
            new Feature("compare", "Uporedi", Widgets.Icon.COMPARE),
            new Feature("merge", "Spoji", Widgets.Icon.MERGE),
            new Feature("compress", "Kompresuj", Widgets.Icon.COMPRESS),
            new Feature("export_text", "Izvezi tekst", Widgets.Icon.EXPORT),
            new Feature("ai_summary", "AI sažetak", Widgets.Icon.SPARK));

    public static Feature feature(String id) {
        for (Feature f : FEATURES) if (f.id.equals(id)) return f;
        return null;
    }

    public static final class Doc {
        public String id, name, kind, size, updated;
        public Color color;
        public int pages;
        public boolean scanned, signed, filled, redacted, ocr, annotated;
        public List<String> summary = new ArrayList<>();
        public List<String[]> changes = new ArrayList<>();      // {"+" ili "-", tekst}
        public List<Map<String, Object>> blocks = new ArrayList<>();

        public boolean has(String blockType) {
            for (Map<String, Object> b : blocks) if (blockType.equals(b.get("type"))) return true;
            return false;
        }

        @SuppressWarnings("unchecked")
        public boolean hasSensitive() {
            for (Map<String, Object> b : blocks) {
                if (!"meta".equals(b.get("type"))) continue;
                for (Object o : (List<Object>) b.get("items")) {
                    if (Boolean.TRUE.equals(((Map<String, Object>) o).get("sensitive"))) return true;
                }
            }
            return false;
        }

        public boolean needsSignature() { return has("signature") && !signed; }
        public boolean needsOcr() { return scanned && !ocr; }
    }

    public static final class Profile {
        public String id, name, role, title;
        public Color color;
        public final Map<String, Integer> usage = new LinkedHashMap<>();
        public final List<Doc> docs = new ArrayList<>();

        public int count(String feature) { return usage.getOrDefault(feature, 0); }
        public void bump(String feature) { usage.put(feature, count(feature) + 1); }

        public String initials() {
            String[] parts = name.replace("Dr ", "").trim().split("\\s+");
            StringBuilder b = new StringBuilder();
            for (String p : parts) if (!p.isEmpty() && b.length() < 2) b.append(p.charAt(0));
            return b.toString().toUpperCase();
        }
    }

    // ---------------- učitavanje i čuvanje ----------------

    public static Path dataDir() { return Paths.get(System.getProperty("folio.data", "folio-data")); }

    public static Profile load(String id) {
        try {
            Path file = dataDir().resolve(id + ".json");
            String text;
            if (Files.exists(file)) {
                text = Files.readString(file, StandardCharsets.UTF_8);
            } else {
                try (InputStream in = Model.class.getResourceAsStream("/data/" + id + ".json")) {
                    if (in == null) throw new IOException("Nema podataka za profil " + id);
                    text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
                Files.createDirectories(dataDir());
                Files.writeString(file, text, StandardCharsets.UTF_8);
            }
            return fromJson(Json.parse(text));
        } catch (IOException ex) {
            throw new RuntimeException("Ne mogu da učitam profil " + id + ": " + ex.getMessage(), ex);
        }
    }

    public static void save(Profile p) {
        try {
            Files.createDirectories(dataDir());
            Files.writeString(dataDir().resolve(p.id + ".json"), Json.write(toJson(p)), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            System.err.println("Čuvanje nije uspelo: " + ex.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private static Profile fromJson(Object root) {
        Map<String, Object> m = (Map<String, Object>) root;
        Profile p = new Profile();
        p.id = str(m, "id");
        p.name = str(m, "name");
        p.role = str(m, "role");
        p.title = str(m, "title");
        p.color = Theme.hex(str(m, "color"));
        Map<String, Object> usage = (Map<String, Object>) m.getOrDefault("usage", Map.of());
        for (Feature f : FEATURES) p.usage.put(f.id, ((Number) usage.getOrDefault(f.id, 0.0)).intValue());
        for (Object o : (List<Object>) m.getOrDefault("documents", List.of())) {
            Map<String, Object> dm = (Map<String, Object>) o;
            Doc d = new Doc();
            d.id = str(dm, "id");
            d.name = str(dm, "name");
            d.kind = str(dm, "kind");
            d.size = str(dm, "size");
            d.updated = str(dm, "updated");
            d.color = Theme.hex(str(dm, "color"));
            d.pages = ((Number) dm.getOrDefault("pages", 1.0)).intValue();
            d.scanned = bool(dm, "scanned");
            d.signed = bool(dm, "signed");
            d.filled = bool(dm, "filled");
            d.redacted = bool(dm, "redacted");
            d.ocr = bool(dm, "ocr");
            d.annotated = bool(dm, "annotated");
            for (Object s : (List<Object>) dm.getOrDefault("summary", List.of())) d.summary.add(String.valueOf(s));
            for (Object c : (List<Object>) dm.getOrDefault("changes", List.of())) {
                Map<String, Object> cm = (Map<String, Object>) c;
                d.changes.add(new String[] { str(cm, "type"), str(cm, "text") });
            }
            for (Object b : (List<Object>) dm.getOrDefault("blocks", List.of())) d.blocks.add((Map<String, Object>) b);
            p.docs.add(d);
        }
        return p;
    }

    private static Map<String, Object> toJson(Profile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id);
        m.put("name", p.name);
        m.put("role", p.role);
        m.put("title", p.title);
        m.put("color", Theme.toHex(p.color));
        m.put("usage", new LinkedHashMap<String, Object>(p.usage));
        List<Object> docs = new ArrayList<>();
        for (Doc d : p.docs) {
            Map<String, Object> dm = new LinkedHashMap<>();
            dm.put("id", d.id);
            dm.put("name", d.name);
            dm.put("kind", d.kind);
            dm.put("color", Theme.toHex(d.color));
            dm.put("pages", d.pages);
            dm.put("size", d.size);
            dm.put("updated", d.updated);
            dm.put("scanned", d.scanned);
            dm.put("signed", d.signed);
            dm.put("filled", d.filled);
            dm.put("redacted", d.redacted);
            dm.put("ocr", d.ocr);
            dm.put("annotated", d.annotated);
            dm.put("summary", new ArrayList<Object>(d.summary));
            List<Object> ch = new ArrayList<>();
            for (String[] c : d.changes) {
                Map<String, Object> cm = new LinkedHashMap<>();
                cm.put("type", c[0]);
                cm.put("text", c[1]);
                ch.add(cm);
            }
            dm.put("changes", ch);
            dm.put("blocks", new ArrayList<Object>(d.blocks));
            docs.add(dm);
        }
        m.put("documents", docs);
        return m;
    }

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? "" : String.valueOf(v);
    }

    private static boolean bool(Map<String, Object> m, String k) { return Boolean.TRUE.equals(m.get(k)); }
}
