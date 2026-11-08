package folio;

import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import javax.swing.JButton;
import javax.swing.JTextField;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

/** Hand-drawn controls: buttons, fields and avatars. */
public final class Widgets {
    private Widgets() {}

    /** CHROME: a button on the black top bar; the selected one is yellow (marker). */
    public enum Kind { PRIMARY, OUTLINE, SOFT, GHOST, CHROME }

    /** Rounded button with text. */
    public static class Pill extends JButton {
        private Kind kind;
        private Color color = Theme.ACCENT;
        private boolean selected;
        private boolean shadow;
        private Color dot;
        private Icon icon;

        public Pill(String text, Kind kind) {
            super(text);
            this.kind = kind;
            setFont(Theme.bold(13f));
            setContentAreaFilled(false);
            setBorderPainted(false);
            setFocusPainted(false);
            setOpaque(false);
            setRolloverEnabled(true);
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            setBorder(new EmptyBorder(8, 16, 8, 16));
        }

        public Pill color(Color c) { this.color = c; repaint(); return this; }
        public Pill shadow(boolean s) { this.shadow = s; return this; }
        public Pill dot(Color c) { this.dot = c; return this; }
        public Pill icon(Icon i) { this.icon = i; return this; }
        public void setSelectedPill(boolean s) { this.selected = s; repaint(); }
        public boolean isSelectedPill() { return selected; }
        public void setKind(Kind k) { this.kind = k; repaint(); }

        @Override public Dimension getPreferredSize() {
            FontMetrics fm = getFontMetrics(getFont());
            Insets in = getInsets();
            int w = fm.stringWidth(getText()) + in.left + in.right + (dot != null ? 16 : 0) + (icon != null ? 24 : 0);
            int h = fm.getHeight() + in.top + in.bottom;
            return new Dimension(w, Math.max(h, 34));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            int w = getWidth(), h = getHeight();
            int pad = shadow ? 4 : 0;
            boolean hover = getModel().isRollover();
            boolean press = getModel().isPressed();
            double r = h - pad * 2;
            RoundRectangle2D shape = new RoundRectangle2D.Double(pad, pad / 2.0, w - pad * 2 - 1, h - pad * 2 - 1, r, r);
            Color bg = null, fg = Theme.TEXT, border = null;
            boolean on = selected || kind == Kind.PRIMARY;
            if (kind == Kind.CHROME) {
                if (selected) { bg = Theme.MARKER; fg = Theme.TEXT; }
                else { bg = press ? Theme.CHROME_LINE : hover ? Theme.CHROME_HOVER : null; fg = Theme.CHROME_TEXT; border = Theme.CHROME_LINE; }
            } else if (kind == Kind.PRIMARY || selected) {
                bg = press ? Theme.mix(color, Color.BLACK, 0.15) : hover ? Theme.mix(color, Color.BLACK, 0.07) : color;
                fg = Color.WHITE;
            } else if (kind == Kind.OUTLINE) {
                bg = hover ? Theme.HOVER : Theme.BG;
                border = Theme.BORDER;
            } else if (kind == Kind.SOFT) {
                bg = hover ? Theme.tintHover(color) : Theme.tint(color);
                fg = Theme.ink(color);
            } else {
                bg = hover ? Theme.HOVER : null;
            }
            if (shadow && on) Theme.shadow(g2, pad, pad / 2.0, w - pad * 2 - 1, h - pad * 2 - 1, r, 6, 60);
            else if (shadow) Theme.shadow(g2, pad, pad / 2.0, w - pad * 2 - 1, h - pad * 2 - 1, r, 5, 40);
            if (bg != null) { g2.setColor(bg); g2.fill(shape); }
            if (border != null) { g2.setColor(border); Theme.stroke(g2, 1f); g2.draw(shape); }
            g2.setFont(getFont());
            FontMetrics fm = g2.getFontMetrics();
            int tw = fm.stringWidth(getText()) + (dot != null ? 16 : 0) + (icon != null ? 24 : 0);
            int x = (w - tw) / 2;
            int y = (h - fm.getHeight()) / 2 + fm.getAscent() - (shadow ? 1 : 0);
            if (dot != null) {
                g2.setColor(on ? Color.WHITE : dot);
                g2.fill(new Ellipse2D.Double(x, h / 2.0 - 4 - (shadow ? 1 : 0), 8, 8));
                x += 16;
            }
            if (icon != null) {
                g2.setColor(fg == Theme.TEXT ? Theme.MUTED : fg);
                paintIcon(g2, icon, x + 8, h / 2.0 - (shadow ? 1 : 0), 15);
                x += 24;
            }
            g2.setColor(fg);
            g2.drawString(getText(), x, y);
            g2.dispose();
        }
    }

    public enum Icon { LEFT, RIGHT, CLOSE, PLUS, CLOCK, PIN, PEOPLE, VIDEO, TEXT, TRASH, CALENDAR,
        EYE, SEARCH, COMMENT, SIGN, FORM, SCAN, REDACT, COMPARE, MERGE, COMPRESS, EXPORT, SPARK, FILE, UPLOAD }

    /** Round button with an icon. */
    public static class IconButton extends JButton {
        private final Icon icon;

        public IconButton(Icon icon, String tooltip) {
            this.icon = icon;
            setToolTipText(tooltip);
            setContentAreaFilled(false);
            setBorderPainted(false);
            setFocusPainted(false);
            setOpaque(false);
            setRolloverEnabled(true);
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            setPreferredSize(new Dimension(36, 36));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            int s = Math.min(getWidth(), getHeight());
            if (getModel().isRollover()) {
                g2.setColor(getModel().isPressed() ? Theme.GRID : Theme.HOVER);
                g2.fill(new Ellipse2D.Double((getWidth() - s) / 2.0, (getHeight() - s) / 2.0, s, s));
            }
            g2.setColor(Theme.MUTED);
            paintIcon(g2, icon, getWidth() / 2.0, getHeight() / 2.0, 16);
            g2.dispose();
        }
    }

    /** Draws an icon centered at (cx, cy) with the given size. */
    public static void paintIcon(Graphics2D g2, Icon icon, double cx, double cy, double size) {
        double h = size / 2.0;
        Theme.stroke(g2, 1.8f);
        Path2D p = new Path2D.Double();
        switch (icon) {
            case LEFT:
                p.moveTo(cx + h * 0.35, cy - h * 0.7); p.lineTo(cx - h * 0.35, cy); p.lineTo(cx + h * 0.35, cy + h * 0.7);
                g2.draw(p); break;
            case RIGHT:
                p.moveTo(cx - h * 0.35, cy - h * 0.7); p.lineTo(cx + h * 0.35, cy); p.lineTo(cx - h * 0.35, cy + h * 0.7);
                g2.draw(p); break;
            case CLOSE:
                p.moveTo(cx - h * 0.6, cy - h * 0.6); p.lineTo(cx + h * 0.6, cy + h * 0.6);
                p.moveTo(cx + h * 0.6, cy - h * 0.6); p.lineTo(cx - h * 0.6, cy + h * 0.6);
                g2.draw(p); break;
            case PLUS:
                p.moveTo(cx - h * 0.7, cy); p.lineTo(cx + h * 0.7, cy);
                p.moveTo(cx, cy - h * 0.7); p.lineTo(cx, cy + h * 0.7);
                g2.draw(p); break;
            case CLOCK:
                g2.draw(new Ellipse2D.Double(cx - h * 0.8, cy - h * 0.8, h * 1.6, h * 1.6));
                p.moveTo(cx, cy - h * 0.45); p.lineTo(cx, cy); p.lineTo(cx + h * 0.35, cy + h * 0.25);
                g2.draw(p); break;
            case PIN:
                p.moveTo(cx, cy + h * 0.85);
                p.curveTo(cx - h * 0.9, cy - h * 0.05, cx - h * 0.75, cy - h * 0.85, cx, cy - h * 0.85);
                p.curveTo(cx + h * 0.75, cy - h * 0.85, cx + h * 0.9, cy - h * 0.05, cx, cy + h * 0.85);
                g2.draw(p);
                g2.draw(new Ellipse2D.Double(cx - h * 0.22, cy - h * 0.42, h * 0.44, h * 0.44));
                break;
            case PEOPLE:
                g2.draw(new Ellipse2D.Double(cx - h * 0.55, cy - h * 0.75, h * 0.6, h * 0.6));
                p.moveTo(cx - h * 0.95, cy + h * 0.75);
                p.curveTo(cx - h * 0.95, cy + h * 0.05, cx + h * 0.15, cy + h * 0.05, cx + h * 0.15, cy + h * 0.75);
                g2.draw(new Ellipse2D.Double(cx + h * 0.15, cy - h * 0.6, h * 0.5, h * 0.5));
                p.moveTo(cx + h * 0.35, cy + h * 0.05);
                p.curveTo(cx + h * 0.75, cy + h * 0.05, cx + h * 0.95, cy + h * 0.35, cx + h * 0.95, cy + h * 0.65);
                g2.draw(p); break;
            case VIDEO:
                g2.draw(new RoundRectangle2D.Double(cx - h * 0.9, cy - h * 0.55, h * 1.25, h * 1.1, h * 0.35, h * 0.35));
                p.moveTo(cx + h * 0.4, cy - h * 0.15); p.lineTo(cx + h * 0.9, cy - h * 0.45);
                p.lineTo(cx + h * 0.9, cy + h * 0.45); p.lineTo(cx + h * 0.4, cy + h * 0.15);
                g2.draw(p); break;
            case TEXT:
                for (int k = 0; k < 3; k++) {
                    double y = cy - h * 0.55 + k * h * 0.55;
                    p.moveTo(cx - h * 0.8, y); p.lineTo(cx + (k == 2 ? h * 0.2 : h * 0.8), y);
                }
                g2.draw(p); break;
            case TRASH:
                p.moveTo(cx - h * 0.8, cy - h * 0.5); p.lineTo(cx + h * 0.8, cy - h * 0.5);
                p.moveTo(cx - h * 0.3, cy - h * 0.5); p.lineTo(cx - h * 0.2, cy - h * 0.8);
                p.lineTo(cx + h * 0.2, cy - h * 0.8); p.lineTo(cx + h * 0.3, cy - h * 0.5);
                p.moveTo(cx - h * 0.6, cy - h * 0.5); p.lineTo(cx - h * 0.45, cy + h * 0.85);
                p.lineTo(cx + h * 0.45, cy + h * 0.85); p.lineTo(cx + h * 0.6, cy - h * 0.5);
                g2.draw(p); break;
            case CALENDAR:
                g2.draw(new RoundRectangle2D.Double(cx - h * 0.85, cy - h * 0.7, h * 1.7, h * 1.55, h * 0.4, h * 0.4));
                p.moveTo(cx - h * 0.85, cy - h * 0.2); p.lineTo(cx + h * 0.85, cy - h * 0.2);
                p.moveTo(cx - h * 0.4, cy - h * 0.95); p.lineTo(cx - h * 0.4, cy - h * 0.5);
                p.moveTo(cx + h * 0.4, cy - h * 0.95); p.lineTo(cx + h * 0.4, cy - h * 0.5);
                g2.draw(p); break;
            case EYE:
                p.moveTo(cx - h * 0.95, cy);
                p.curveTo(cx - h * 0.5, cy - h * 0.7, cx + h * 0.5, cy - h * 0.7, cx + h * 0.95, cy);
                p.curveTo(cx + h * 0.5, cy + h * 0.7, cx - h * 0.5, cy + h * 0.7, cx - h * 0.95, cy);
                g2.draw(p);
                g2.draw(new Ellipse2D.Double(cx - h * 0.28, cy - h * 0.28, h * 0.56, h * 0.56));
                break;
            case SEARCH:
                g2.draw(new Ellipse2D.Double(cx - h * 0.8, cy - h * 0.8, h * 1.2, h * 1.2));
                p.moveTo(cx + h * 0.28, cy + h * 0.28); p.lineTo(cx + h * 0.85, cy + h * 0.85);
                g2.draw(p); break;
            case COMMENT:
                p.moveTo(cx - h * 0.85, cy - h * 0.65); p.lineTo(cx + h * 0.85, cy - h * 0.65);
                p.lineTo(cx + h * 0.85, cy + h * 0.35); p.lineTo(cx - h * 0.1, cy + h * 0.35);
                p.lineTo(cx - h * 0.55, cy + h * 0.85); p.lineTo(cx - h * 0.55, cy + h * 0.35);
                p.lineTo(cx - h * 0.85, cy + h * 0.35); p.closePath();
                g2.draw(p); break;
            case SIGN:
                p.moveTo(cx - h * 0.9, cy + h * 0.45);
                p.curveTo(cx - h * 0.6, cy - h * 0.6, cx - h * 0.3, cy + h * 0.6, cx, cy - h * 0.05);
                p.curveTo(cx + h * 0.2, cy - h * 0.5, cx + h * 0.35, cy + h * 0.45, cx + h * 0.9, cy - h * 0.1);
                p.moveTo(cx - h * 0.9, cy + h * 0.85); p.lineTo(cx + h * 0.9, cy + h * 0.85);
                g2.draw(p); break;
            case FORM:
                g2.draw(new RoundRectangle2D.Double(cx - h * 0.75, cy - h * 0.9, h * 1.5, h * 1.8, h * 0.3, h * 0.3));
                p.moveTo(cx - h * 0.4, cy - h * 0.35); p.lineTo(cx + h * 0.4, cy - h * 0.35);
                p.moveTo(cx - h * 0.4, cy + h * 0.05); p.lineTo(cx + h * 0.4, cy + h * 0.05);
                p.moveTo(cx - h * 0.4, cy + h * 0.45); p.lineTo(cx + h * 0.1, cy + h * 0.45);
                g2.draw(p); break;
            case SCAN:
                p.moveTo(cx - h * 0.9, cy - h * 0.4); p.lineTo(cx - h * 0.9, cy - h * 0.9); p.lineTo(cx - h * 0.4, cy - h * 0.9);
                p.moveTo(cx + h * 0.4, cy - h * 0.9); p.lineTo(cx + h * 0.9, cy - h * 0.9); p.lineTo(cx + h * 0.9, cy - h * 0.4);
                p.moveTo(cx + h * 0.9, cy + h * 0.4); p.lineTo(cx + h * 0.9, cy + h * 0.9); p.lineTo(cx + h * 0.4, cy + h * 0.9);
                p.moveTo(cx - h * 0.4, cy + h * 0.9); p.lineTo(cx - h * 0.9, cy + h * 0.9); p.lineTo(cx - h * 0.9, cy + h * 0.4);
                p.moveTo(cx - h * 0.5, cy); p.lineTo(cx + h * 0.5, cy);
                g2.draw(p); break;
            case REDACT:
                g2.draw(new RoundRectangle2D.Double(cx - h * 0.9, cy - h * 0.75, h * 1.8, h * 1.5, h * 0.3, h * 0.3));
                g2.fill(new java.awt.geom.Rectangle2D.Double(cx - h * 0.55, cy - h * 0.2, h * 1.1, h * 0.4));
                break;
            case COMPARE:
                g2.draw(new RoundRectangle2D.Double(cx - h * 0.9, cy - h * 0.8, h * 0.8, h * 1.6, h * 0.2, h * 0.2));
                g2.draw(new RoundRectangle2D.Double(cx + h * 0.1, cy - h * 0.8, h * 0.8, h * 1.6, h * 0.2, h * 0.2));
                break;
            case MERGE:
                p.moveTo(cx - h * 0.8, cy - h * 0.8); p.lineTo(cx - h * 0.8, cy - h * 0.2);
                p.curveTo(cx - h * 0.8, cy + h * 0.2, cx, cy + h * 0.1, cx, cy + h * 0.5);
                p.moveTo(cx + h * 0.8, cy - h * 0.8); p.lineTo(cx + h * 0.8, cy - h * 0.2);
                p.curveTo(cx + h * 0.8, cy + h * 0.2, cx, cy + h * 0.1, cx, cy + h * 0.5);
                p.lineTo(cx, cy + h * 0.9);
                g2.draw(p); break;
            case COMPRESS:
                p.moveTo(cx - h * 0.45, cy - h * 0.9); p.lineTo(cx, cy - h * 0.4); p.lineTo(cx + h * 0.45, cy - h * 0.9);
                p.moveTo(cx - h * 0.45, cy + h * 0.9); p.lineTo(cx, cy + h * 0.4); p.lineTo(cx + h * 0.45, cy + h * 0.9);
                p.moveTo(cx - h * 0.85, cy); p.lineTo(cx + h * 0.85, cy);
                g2.draw(p); break;
            case EXPORT:
                p.moveTo(cx, cy + h * 0.3); p.lineTo(cx, cy - h * 0.9);
                p.moveTo(cx - h * 0.45, cy - h * 0.45); p.lineTo(cx, cy - h * 0.9); p.lineTo(cx + h * 0.45, cy - h * 0.45);
                p.moveTo(cx - h * 0.85, cy + h * 0.1); p.lineTo(cx - h * 0.85, cy + h * 0.85);
                p.lineTo(cx + h * 0.85, cy + h * 0.85); p.lineTo(cx + h * 0.85, cy + h * 0.1);
                g2.draw(p); break;
            case SPARK:
                // AI summary: text being shortened (no "magic" sparkles).
                p.moveTo(cx - h * 0.85, cy - h * 0.6); p.lineTo(cx + h * 0.85, cy - h * 0.6);
                p.moveTo(cx - h * 0.85, cy - h * 0.05); p.lineTo(cx + h * 0.35, cy - h * 0.05);
                p.moveTo(cx - h * 0.85, cy + h * 0.5); p.lineTo(cx - h * 0.15, cy + h * 0.5);
                g2.draw(p);
                Theme.stroke(g2, 1.4f);
                Path2D arrow = new Path2D.Double();
                arrow.moveTo(cx + h * 0.35, cy + h * 0.2); arrow.lineTo(cx + h * 0.75, cy + h * 0.5); arrow.lineTo(cx + h * 0.35, cy + h * 0.8);
                g2.draw(arrow);
                Theme.stroke(g2, 1.8f);
                break;
            case FILE:
                p.moveTo(cx - h * 0.7, cy - h * 0.9); p.lineTo(cx + h * 0.25, cy - h * 0.9); p.lineTo(cx + h * 0.7, cy - h * 0.45);
                p.lineTo(cx + h * 0.7, cy + h * 0.9); p.lineTo(cx - h * 0.7, cy + h * 0.9); p.closePath();
                p.moveTo(cx + h * 0.25, cy - h * 0.9); p.lineTo(cx + h * 0.25, cy - h * 0.45); p.lineTo(cx + h * 0.7, cy - h * 0.45);
                g2.draw(p); break;
            case UPLOAD:
                p.moveTo(cx, cy + h * 0.5); p.lineTo(cx, cy - h * 0.8);
                p.moveTo(cx - h * 0.5, cy - h * 0.3); p.lineTo(cx, cy - h * 0.8); p.lineTo(cx + h * 0.5, cy - h * 0.3);
                p.moveTo(cx - h * 0.85, cy + h * 0.9); p.lineTo(cx + h * 0.85, cy + h * 0.9);
                g2.draw(p); break;
            default:
                break;
        }
    }

    /** Circle with initials. */
    public static void avatar(Graphics2D g2, String initials, Color color, double x, double y, double d) {
        g2.setColor(color);
        g2.fill(new Ellipse2D.Double(x, y, d, d));
        g2.setColor(Color.WHITE);
        g2.setFont(Theme.bold((float) (d * 0.4)));
        FontMetrics fm = g2.getFontMetrics();
        g2.drawString(initials, (float) (x + (d - fm.stringWidth(initials)) / 2.0),
                (float) (y + (d - fm.getHeight()) / 2.0 + fm.getAscent()));
    }

    public static String initialsOf(String name) {
        String clean = name.replaceAll("\\(.*?\\)", "").replace("Dr ", "").trim();
        String[] parts = clean.split("\\s+");
        StringBuilder b = new StringBuilder();
        for (String p : parts) if (!p.isEmpty() && Character.isLetter(p.charAt(0)) && b.length() < 2) b.append(p.charAt(0));
        return b.length() == 0 ? "?" : b.toString().toUpperCase();
    }

    /** Rounded text field with a placeholder. */
    public static class Field extends JTextField {
        private final String placeholder;

        public Field(String placeholder) {
            this.placeholder = placeholder;
            setFont(Theme.font(14f));
            setForeground(Theme.TEXT);
            setCaretColor(Theme.ACCENT);
            setOpaque(false);
            setBorder(new EmptyBorder(9, 14, 9, 14));
            setSelectionColor(Theme.ACCENT_SOFT);
            getDocument().addDocumentListener(new DocumentListener() {
                public void insertUpdate(DocumentEvent e) { repaint(); }
                public void removeUpdate(DocumentEvent e) { repaint(); }
                public void changedUpdate(DocumentEvent e) { repaint(); }
            });
            addFocusListener(new java.awt.event.FocusAdapter() {
                public void focusGained(java.awt.event.FocusEvent e) { repaint(); }
                public void focusLost(java.awt.event.FocusEvent e) { repaint(); }
            });
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            RoundRectangle2D shape = new RoundRectangle2D.Double(0.5, 0.5, getWidth() - 1, getHeight() - 1, 12, 12);
            g2.setColor(hasFocus() ? Theme.BG : Theme.SIDEBAR);
            g2.fill(shape);
            g2.setColor(hasFocus() ? Theme.ACCENT : Theme.BORDER);
            Theme.stroke(g2, hasFocus() ? 1.6f : 1f);
            g2.draw(shape);
            g2.dispose();
            super.paintComponent(g);
            if (getText().isEmpty() && !placeholder.isEmpty()) {
                Graphics2D g3 = Theme.smooth(g);
                g3.setFont(getFont());
                g3.setColor(Theme.FAINT);
                Insets in = getInsets();
                FontMetrics fm = g3.getFontMetrics();
                g3.drawString(placeholder, in.left, (getHeight() - fm.getHeight()) / 2 + fm.getAscent());
                g3.dispose();
            }
        }
    }
}
