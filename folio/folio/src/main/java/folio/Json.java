package folio;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Mali JSON parser i pisac bez spoljnih biblioteka. Objekti su LinkedHashMap, nizovi ArrayList. */
public final class Json {
    private final String s;
    private int i;

    private Json(String s) { this.s = s; }

    public static Object parse(String text) {
        Json p = new Json(text);
        p.ws();
        Object v = p.value();
        p.ws();
        if (p.i != p.s.length()) throw p.err("Višak teksta posle JSON vrednosti");
        return v;
    }

    private RuntimeException err(String msg) {
        return new IllegalArgumentException(msg + " (pozicija " + i + ")");
    }

    private void ws() {
        while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
    }

    private Object value() {
        if (i >= s.length()) throw err("Neočekivan kraj");
        char c = s.charAt(i);
        switch (c) {
            case '{': return object();
            case '[': return array();
            case '"': return string();
            case 't': expect("true"); return Boolean.TRUE;
            case 'f': expect("false"); return Boolean.FALSE;
            case 'n': expect("null"); return null;
            default: return number();
        }
    }

    private void expect(String word) {
        if (!s.startsWith(word, i)) throw err("Očekivano " + word);
        i += word.length();
    }

    private Map<String, Object> object() {
        Map<String, Object> m = new LinkedHashMap<>();
        i++;
        ws();
        if (s.charAt(i) == '}') { i++; return m; }
        while (true) {
            ws();
            if (s.charAt(i) != '"') throw err("Očekivan ključ");
            String k = string();
            ws();
            if (s.charAt(i) != ':') throw err("Očekivano ':'");
            i++;
            ws();
            m.put(k, value());
            ws();
            char c = s.charAt(i++);
            if (c == '}') return m;
            if (c != ',') throw err("Očekivano ',' ili '}'");
        }
    }

    private List<Object> array() {
        List<Object> a = new ArrayList<>();
        i++;
        ws();
        if (s.charAt(i) == ']') { i++; return a; }
        while (true) {
            ws();
            a.add(value());
            ws();
            char c = s.charAt(i++);
            if (c == ']') return a;
            if (c != ',') throw err("Očekivano ',' ili ']'");
        }
    }

    private String string() {
        StringBuilder b = new StringBuilder();
        i++;
        while (true) {
            if (i >= s.length()) throw err("Nezatvoren string");
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c == '\\') {
                char e = s.charAt(i++);
                switch (e) {
                    case '"': b.append('"'); break;
                    case '\\': b.append('\\'); break;
                    case '/': b.append('/'); break;
                    case 'b': b.append('\b'); break;
                    case 'f': b.append('\f'); break;
                    case 'n': b.append('\n'); break;
                    case 'r': b.append('\r'); break;
                    case 't': b.append('\t'); break;
                    case 'u':
                        b.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default: throw err("Nepoznat escape");
                }
            } else {
                b.append(c);
            }
        }
    }

    private Double number() {
        int st = i;
        while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        if (st == i) throw err("Neočekivan znak '" + s.charAt(i) + "'");
        return Double.parseDouble(s.substring(st, i));
    }

    // ---------- pisanje ----------

    public static String write(Object v) {
        StringBuilder b = new StringBuilder();
        write(b, v, 0);
        b.append('\n');
        return b.toString();
    }

    @SuppressWarnings("unchecked")
    private static void write(StringBuilder b, Object v, int ind) {
        if (v == null) { b.append("null"); return; }
        if (v instanceof String) { str(b, (String) v); return; }
        if (v instanceof Boolean) { b.append(v); return; }
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (d == Math.rint(d) && !Double.isInfinite(d)) b.append((long) d); else b.append(d);
            return;
        }
        if (v instanceof Map) {
            Map<String, Object> m = (Map<String, Object>) v;
            if (m.isEmpty()) { b.append("{}"); return; }
            b.append("{\n");
            int n = 0;
            for (Map.Entry<String, Object> e : m.entrySet()) {
                pad(b, ind + 2);
                str(b, e.getKey());
                b.append(": ");
                write(b, e.getValue(), ind + 2);
                if (++n < m.size()) b.append(',');
                b.append('\n');
            }
            pad(b, ind);
            b.append('}');
            return;
        }
        if (v instanceof List) {
            List<Object> a = (List<Object>) v;
            if (a.isEmpty()) { b.append("[]"); return; }
            boolean simple = a.stream().allMatch(x -> !(x instanceof Map) && !(x instanceof List));
            if (simple) {
                b.append('[');
                for (int k = 0; k < a.size(); k++) {
                    if (k > 0) b.append(", ");
                    write(b, a.get(k), ind);
                }
                b.append(']');
                return;
            }
            b.append("[\n");
            for (int k = 0; k < a.size(); k++) {
                pad(b, ind + 2);
                write(b, a.get(k), ind + 2);
                if (k < a.size() - 1) b.append(',');
                b.append('\n');
            }
            pad(b, ind);
            b.append(']');
            return;
        }
        str(b, v.toString());
    }

    private static void pad(StringBuilder b, int n) {
        for (int k = 0; k < n; k++) b.append(' ');
    }

    private static void str(StringBuilder b, String v) {
        b.append('"');
        for (int k = 0; k < v.length(); k++) {
            char c = v.charAt(k);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
            }
        }
        b.append('"');
    }
}
