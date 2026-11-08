package folio;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Folio visual identity: a text highlighter. White paper, black ink, and a single signal yellow
 * (the marker) only for what needs attention or is currently selected. The top bar is black.
 */
public final class Theme {
    private Theme() {}

    // Paper and ink (neutral, no warm or cool tint).
    public static final Color BG = hex("#FFFFFF");
    public static final Color SIDEBAR = hex("#F5F5F5");
    public static final Color GRID = hex("#E4E4E4");
    public static final Color GRID_SOFT = hex("#F0F0F0");
    public static final Color WEEKEND = hex("#FAFAFA");
    public static final Color BORDER = hex("#DADADA");
    public static final Color TEXT = hex("#161616");
    public static final Color MUTED = hex("#575757");
    /** Placeholder and secondary text; still at least 4.5:1 on white and on SIDEBAR. */
    public static final Color FAINT = hex("#6B6B6B");
    public static final Color HOVER = hex("#EDEDED");
    /** Primary action and selection: ink. */
    public static final Color ACCENT = TEXT;

    // Marker: only for attention (awaiting signature, empty form, personal data) and the current selection.
    public static final Color MARKER = hex("#FFD60A");
    public static final Color MARKER_SOFT = hex("#FFF1A6");
    public static final Color ACCENT_SOFT = MARKER_SOFT;
    public static final Color NOW = hex("#E5484D");

    // Black top bar.
    public static final Color CHROME = hex("#121212");
    public static final Color CHROME_LINE = hex("#2F2F2F");
    public static final Color CHROME_TEXT = hex("#F5F5F5");
    public static final Color CHROME_MUTED = hex("#B3B3B3");
    public static final Color CHROME_HOVER = hex("#262626");

    // Font: Atkinson Hyperlegible (Braille Institute, OFL), bundled in the jar. Falls back to the system sans.
    private static final String FAMILY = pickFamily();
    private static final Font REGULAR = load("/fonts/AtkinsonHyperlegible-Regular.ttf");
    private static final Font BOLD = load("/fonts/AtkinsonHyperlegible-Bold.ttf");

    private static Font load(String resource) {
        try (InputStream in = Theme.class.getResourceAsStream(resource)) {
            if (in == null) return null;
            Font f = Font.createFont(Font.TRUETYPE_FONT, in);
            GraphicsEnvironment.getLocalGraphicsEnvironment().registerFont(f);
            return f.deriveFont(12f);
        } catch (Exception e) {
            return null;
        }
    }

    private static String pickFamily() {
        Set<String> have = new HashSet<>(Arrays.asList(
                GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames()));
        for (String f : new String[] { "Segoe UI Variable Text", "Segoe UI", "SF Pro Text", ".AppleSystemUIFont",
                "Helvetica Neue", "Roboto", "Noto Sans", "Ubuntu", "Cantarell", "DejaVu Sans" }) {
            if (have.contains(f)) return f;
        }
        return Font.SANS_SERIF;
    }

    public static Font font(float size) {
        return REGULAR != null ? REGULAR.deriveFont(size) : new Font(FAMILY, Font.PLAIN, 12).deriveFont(size);
    }

    public static Font bold(float size) {
        return BOLD != null ? BOLD.deriveFont(size) : new Font(FAMILY, Font.BOLD, 12).deriveFont(size);
    }

    public static Color hex(String h) {
        String s = h.startsWith("#") ? h.substring(1) : h;
        return new Color(Integer.parseInt(s, 16));
    }

    public static String toHex(Color c) {
        return String.format("#%02X%02X%02X", c.getRed(), c.getGreen(), c.getBlue());
    }

    /** Mix of two colors; t = 0 gives a, t = 1 gives b. */
    public static Color mix(Color a, Color b, double t) {
        return new Color(
                (int) Math.round(a.getRed() + (b.getRed() - a.getRed()) * t),
                (int) Math.round(a.getGreen() + (b.getGreen() - a.getGreen()) * t),
                (int) Math.round(a.getBlue() + (b.getBlue() - a.getBlue()) * t));
    }

    /** Light background from a color. */
    public static Color tint(Color c) { return mix(c, Color.WHITE, 0.84); }

    public static Color tintHover(Color c) { return mix(c, Color.WHITE, 0.74); }

    /** Dark version of a color for readable text on a light background. */
    public static Color ink(Color c) { return mix(c, TEXT, 0.6); }

    public static Color alpha(Color c, int a) { return new Color(c.getRed(), c.getGreen(), c.getBlue(), a); }

    public static Graphics2D smooth(Graphics g) {
        Graphics2D g2 = (Graphics2D) g.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
        g2.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
        g2.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        return g2;
    }

    /** Soft shadow under a rounded rectangle (only for the document paper). */
    public static void shadow(Graphics2D g2, double x, double y, double w, double h, double r, int layers, int strength) {
        for (int k = layers; k >= 1; k--) {
            int a = Math.max(1, strength / (k + 1));
            g2.setColor(new Color(0, 0, 0, a));
            g2.fill(new RoundRectangle2D.Double(x - k * 0.5, y - k * 0.2 + k * 0.8, w + k, h + k * 0.6, r + k, r + k));
        }
    }

    /** Marker stroke: a slightly slanted rectangle behind the text. */
    public static void marker(Graphics2D g2, double x, double y, double w, double h) {
        java.awt.geom.Path2D p = new java.awt.geom.Path2D.Double();
        p.moveTo(x + 2, y + 1);
        p.lineTo(x + w, y);
        p.lineTo(x + w - 2, y + h - 1);
        p.lineTo(x, y + h);
        p.closePath();
        g2.setColor(MARKER);
        g2.fill(p);
    }

    public static void stroke(Graphics2D g2, float w) { g2.setStroke(new BasicStroke(w, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND)); }

    /** Shortens text with "…" so it fits the given width. */
    public static String fit(String text, java.awt.FontMetrics fm, int width) {
        if (text == null) return "";
        if (fm.stringWidth(text) <= width) return text;
        String dots = "…";
        int end = text.length();
        while (end > 0 && fm.stringWidth(text.substring(0, end) + dots) > width) end--;
        return end <= 0 ? "" : text.substring(0, end).trim() + dots;
    }
}
