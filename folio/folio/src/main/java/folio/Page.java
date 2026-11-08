package folio;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.awt.geom.RoundRectangle2D;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import javax.swing.JComponent;

/** Crta prvu stranu dokumenta kao pravi PDF, sa stanjem: potpis, zacrnjeno, popunjeno, OCR, komentar. */
public class Page extends JComponent {
    static final int PW = 620, PH = 877, M = 58;
    static final Color CANVAS = Theme.hex("#E9E9E9");
    static final Color BODY = Theme.hex("#3A4150");
    static final Color INK_BLUE = Theme.hex("#1E3A8A");

    private final App app;

    public Page(App app) {
        this.app = app;
        setOpaque(true);
    }

    @Override public Dimension getPreferredSize() { return new Dimension(PW + 80, PH + 120); }

    @Override protected void paintComponent(Graphics g) {
        Graphics2D g2 = Theme.smooth(g);
        int w = getWidth(), h = getHeight();
        g2.setColor(CANVAS);
        g2.fillRect(0, 0, w, h);
        Model.Doc d = app.doc;
        if (d == null) { g2.dispose(); return; }

        int px = (w - PW) / 2, py = 52;
        paintChips(g2, d, px, 14);

        Theme.shadow(g2, px, py, PW, PH, 6, 10, 70);
        boolean rawScan = d.needsOcr();
        g2.setColor(rawScan ? Theme.hex("#F4EFE2") : Color.WHITE);
        g2.fill(new RoundRectangle2D.Double(px, py, PW, PH, 6, 6));

        Graphics2D pg = (Graphics2D) g2.create(px, py, PW, PH);
        if (rawScan) {
            pg.rotate(Math.toRadians(-0.7), PW / 2.0, PH / 2.0);
        }
        new Renderer(pg, d, rawScan).render();
        pg.dispose();

        if (rawScan) paintScanNoise(g2, px, py);
        if (d.annotated) paintNote(g2, px + PW - 200, py + 14);

        g2.setFont(Theme.font(12f));
        g2.setColor(Theme.FAINT);
        String foot = "Strana 1 od " + d.pages;
        FontMetrics fm = g2.getFontMetrics();
        g2.drawString(foot, (w - fm.stringWidth(foot)) / 2f, py + PH + 30);
        g2.dispose();
    }

    private void paintChips(Graphics2D g2, Model.Doc d, int x, int y) {
        // Tri stanja: ČEKA (marker, posao za korisnika), GOTOVO (obod + kvačica), INFO (isprekidan obod).
        final int TODO = 0, DONE = 1, INFO = 2;
        List<Object[]> chips = new ArrayList<>();
        if (d.has("signature")) chips.add(d.signed ? new Object[] { "Potpisano", DONE } : new Object[] { "Čeka potpis", TODO });
        if (d.scanned) chips.add(d.ocr ? new Object[] { "Tekst prepoznat (OCR)", DONE } : new Object[] { "Sken bez teksta", INFO });
        if (d.has("form")) chips.add(d.filled ? new Object[] { "Formular popunjen", DONE } : new Object[] { "Prazan formular", TODO });
        if (d.hasSensitive()) chips.add(d.redacted ? new Object[] { "Lični podaci zacrnjeni", DONE } : new Object[] { "Sadrži lične podatke", TODO });
        if (d.annotated) chips.add(new Object[] { "1 komentar", INFO });
        g2.setFont(Theme.bold(12f));
        FontMetrics fm = g2.getFontMetrics();
        for (Object[] c : chips) {
            String t = (String) c[0];
            int state = (Integer) c[1];
            boolean done = state == DONE;
            int cw = fm.stringWidth(t) + (done ? 34 : 22);
            RoundRectangle2D chip = new RoundRectangle2D.Double(x, y, cw, 26, 6, 6);
            if (state == TODO) {
                g2.setColor(Theme.MARKER);
                g2.fill(chip);
            } else {
                g2.setColor(Theme.BG);
                g2.fill(chip);
                g2.setColor(state == DONE ? Theme.TEXT : Theme.MUTED);
                if (state == INFO) {
                    g2.setStroke(new java.awt.BasicStroke(1.1f, java.awt.BasicStroke.CAP_ROUND, java.awt.BasicStroke.JOIN_ROUND, 1f, new float[] { 4f, 3f }, 0f));
                } else {
                    Theme.stroke(g2, 1.2f);
                }
                g2.draw(chip);
            }
            int tx = x + 11;
            if (done) {
                java.awt.geom.Path2D check = new java.awt.geom.Path2D.Double();
                check.moveTo(x + 10, y + 13.5); check.lineTo(x + 13.5, y + 17); check.lineTo(x + 20, y + 9.5);
                g2.setColor(Theme.TEXT);
                Theme.stroke(g2, 1.8f);
                g2.draw(check);
                tx = x + 25;
            }
            g2.setColor(state == INFO ? Theme.MUTED : Theme.TEXT);
            g2.drawString(t, tx, y + 18);
            x += cw + 8;
        }
    }

    private void paintScanNoise(Graphics2D g2, int px, int py) {
        Random r = new Random(7);
        for (int k = 0; k < 900; k++) {
            int a = 20 + r.nextInt(50);
            g2.setColor(new Color(90, 80, 60, a));
            double s = r.nextDouble() * 1.6 + 0.4;
            g2.fill(new Ellipse2D.Double(px + r.nextInt(PW), py + r.nextInt(PH), s, s));
        }
        g2.setColor(new Color(60, 50, 30, 18));
        g2.fill(new Rectangle2D.Double(px, py, 18, PH));
        g2.fill(new Rectangle2D.Double(px + PW - 10, py, 10, PH));
        g2.setFont(Theme.bold(11f));
        String t = "SKENIRANO · TEKST SE NE MOŽE PRETRAŽIVATI";
        FontMetrics fm = g2.getFontMetrics();
        int tw = fm.stringWidth(t) + 24;
        g2.setColor(new Color(27, 33, 48, 210));
        g2.fill(new RoundRectangle2D.Double(px + (PW - tw) / 2.0, py + PH - 46, tw, 26, 26, 26));
        g2.setColor(Color.WHITE);
        g2.drawString(t, px + (PW - tw) / 2f + 12, py + PH - 29);
    }

    private void paintNote(Graphics2D g2, int x, int y) {
        Theme.shadow(g2, x, y, 170, 92, 4, 5, 50);
        g2.setColor(Theme.MARKER_SOFT);
        g2.fill(new RoundRectangle2D.Double(x, y, 170, 92, 4, 4));
        g2.setFont(Theme.bold(11.5f));
        g2.setColor(Theme.TEXT);
        g2.drawString(app.profile.name, x + 12, y + 26);
        g2.setFont(Theme.font(12f));
        g2.drawString("Proveriti pre slanja.", x + 12, y + 48);
        g2.drawString("Pitati za izmene u čl. 9.", x + 12, y + 66);
    }

    // ---------------- crtanje blokova ----------------

    private final class Renderer {
        final Graphics2D g;
        final Model.Doc d;
        final boolean scan;
        final Color text, accent;
        int y = M - 8;
        final int width = PW - M * 2;

        Renderer(Graphics2D g, Model.Doc d, boolean scan) {
            this.g = g;
            this.d = d;
            this.scan = scan;
            this.text = scan ? Theme.hex("#5B5650") : BODY;
            this.accent = scan ? Theme.hex("#7A746C") : d.color;
        }

        @SuppressWarnings("unchecked")
        void render() {
            for (Map<String, Object> b : d.blocks) {
                String type = String.valueOf(b.get("type"));
                switch (type) {
                    case "letterhead": letterhead(str(b, "org"), str(b, "sub")); break;
                    case "title": title(str(b, "text")); break;
                    case "meta": meta((List<Object>) b.get("items")); break;
                    case "h2": h2(str(b, "text")); break;
                    case "p": paragraph(str(b, "text")); break;
                    case "code": code((List<Object>) b.get("lines")); break;
                    case "table": table((List<Object>) b.get("headers"), (List<Object>) b.get("rows")); break;
                    case "form": form((List<Object>) b.get("fields")); break;
                    case "signature": signature((List<Object>) b.get("signers")); break;
                    default: break;
                }
                if (y > PH - 60) break;
            }
            if (d.scanned && d.ocr) {
                g.setFont(Theme.bold(10.5f));
                String t = "OCR · tekst prepoznat";
                FontMetrics fm = g.getFontMetrics();
                int tw = fm.stringWidth(t) + 20;
                g.setColor(Theme.hex("#E6F4EA"));
                g.fill(new RoundRectangle2D.Double(PW - M - tw, 20, tw, 22, 22, 22));
                g.setColor(Theme.hex("#0D652D"));
                g.drawString(t, PW - M - tw + 10, 35);
            }
        }

        String str(Map<String, Object> b, String k) {
            Object v = b.get(k);
            return v == null ? "" : String.valueOf(v);
        }

        void letterhead(String org, String sub) {
            if (!scan) {
                g.setColor(accent);
                g.fill(new Rectangle2D.Double(0, 0, PW, 6));
            }
            g.setColor(accent);
            g.fill(new RoundRectangle2D.Double(M, y, 30, 30, 8, 8));
            g.setColor(scan ? Theme.hex("#F4EFE2") : Color.WHITE);
            g.setFont(Theme.bold(15f));
            String ini = org.substring(0, 1);
            FontMetrics fm = g.getFontMetrics();
            g.drawString(ini, M + 15 - fm.stringWidth(ini) / 2f, y + 21);
            g.setColor(scan ? text : Theme.TEXT);
            g.setFont(Theme.bold(14f));
            g.drawString(org, M + 42, y + 13);
            g.setFont(Theme.font(11f));
            g.setColor(scan ? text : Theme.MUTED);
            g.drawString(sub, M + 42, y + 29);
            y += 50;
            g.setColor(scan ? Theme.hex("#D9D2C2") : Theme.GRID);
            g.fill(new Rectangle2D.Double(M, y, width, 1));
            y += 30;
        }

        void title(String t) {
            g.setFont(Theme.bold(21f));
            g.setColor(scan ? text : Theme.TEXT);
            for (String ln : wrap(t, g.getFontMetrics(), width)) { g.drawString(ln, M, y); y += 28; }
            y += 8;
        }

        @SuppressWarnings("unchecked")
        void meta(List<Object> items) {
            int colW = width / 2;
            int rowY = y;
            for (int k = 0; k < items.size(); k++) {
                Map<String, Object> it = (Map<String, Object>) items.get(k);
                int x = M + (k % 2) * colW;
                int yy = rowY + (k / 2) * 44;
                g.setFont(Theme.bold(9.5f));
                g.setColor(scan ? text : Theme.FAINT);
                g.drawString(str(it, "label").toUpperCase(), x, yy);
                g.setFont(Theme.font(13f));
                g.setColor(scan ? text : Theme.TEXT);
                String v = str(it, "value");
                g.drawString(v, x, yy + 19);
                if (Boolean.TRUE.equals(it.get("sensitive")) && d.redacted) {
                    FontMetrics fm = g.getFontMetrics();
                    g.setColor(Theme.hex("#111111"));
                    g.fill(new RoundRectangle2D.Double(x - 3, yy + 4, fm.stringWidth(v) + 8, 20, 4, 4));
                }
            }
            y = rowY + ((items.size() + 1) / 2) * 44 + 10;
        }

        void h2(String t) {
            y += 8;
            g.setFont(Theme.bold(14f));
            g.setColor(scan ? text : Theme.TEXT);
            g.drawString(t, M, y);
            y += 22;
        }

        void paragraph(String t) {
            g.setFont(Theme.font(12.5f));
            g.setColor(text);
            for (String ln : wrap(t, g.getFontMetrics(), width)) { g.drawString(ln, M, y); y += 19; }
            y += 10;
        }

        void code(List<Object> lines) {
            int h = lines.size() * 18 + 22;
            g.setColor(scan ? Theme.hex("#E9E3D5") : Theme.hex("#F3F5F9"));
            g.fill(new RoundRectangle2D.Double(M, y - 4, width, h, 10, 10));
            g.setColor(accent);
            g.fill(new RoundRectangle2D.Double(M, y - 4, 4, h, 4, 4));
            g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 12));
            g.setColor(scan ? text : Theme.hex("#24304A"));
            int yy = y + 16;
            for (Object o : lines) { g.drawString(String.valueOf(o), M + 18, yy); yy += 18; }
            y += h + 14;
        }

        void table(List<Object> headers, List<Object> rows) {
            int cols = headers.size();
            double[] widths = new double[cols];
            for (int k = 0; k < cols; k++) widths[k] = k == 0 ? width * 0.42 : width * 0.58 / (cols - 1);
            int rowH = 30;
            g.setColor(scan ? Theme.hex("#E9E3D5") : Theme.mix(accent, Color.WHITE, 0.88));
            g.fill(new RoundRectangle2D.Double(M, y, width, rowH, 8, 8));
            g.setFont(Theme.bold(11.5f));
            g.setColor(scan ? text : Theme.ink(accent));
            double x = M + 12;
            for (int k = 0; k < cols; k++) { g.drawString(String.valueOf(headers.get(k)), (float) x, y + 19); x += widths[k]; }
            y += rowH;
            for (int r = 0; r < rows.size(); r++) {
                @SuppressWarnings("unchecked")
                List<Object> row = (List<Object>) rows.get(r);
                boolean last = r == rows.size() - 1 && String.valueOf(row.get(0)).startsWith("Ukupn");
                x = M + 12;
                for (int k = 0; k < cols && k < row.size(); k++) {
                    String cell = String.valueOf(row.get(k));
                    boolean flag = cell.startsWith("!");
                    if (flag) cell = cell.substring(1);
                    if (flag && !scan) {
                        g.setFont(Theme.bold(12.5f));
                        g.setColor(Theme.hex("#C5221F"));
                        g.fill(new Ellipse2D.Double(x - 9, y + 13, 5, 5));
                    } else {
                        g.setFont(last ? Theme.bold(12.5f) : Theme.font(12.5f));
                        g.setColor(k == 0 ? (scan ? text : Theme.TEXT) : text);
                    }
                    g.drawString(Theme.fit(cell, g.getFontMetrics(), (int) widths[k] - 16), (float) x, y + 20);
                    x += widths[k];
                }
                y += rowH;
                g.setColor(scan ? Theme.hex("#DDD5C4") : Theme.GRID);
                g.fill(new Rectangle2D.Double(M, y, width, 1));
            }
            y += 22;
        }

        @SuppressWarnings("unchecked")
        void form(List<Object> fields) {
            for (Object o : fields) {
                Map<String, Object> f = (Map<String, Object>) o;
                g.setFont(Theme.bold(10f));
                g.setColor(Theme.MUTED);
                g.drawString(str(f, "label").toUpperCase(), M, y);
                RoundRectangle2D box = new RoundRectangle2D.Double(M, y + 6, width, 32, 8, 8);
                g.setColor(d.filled ? Theme.hex("#F5F8FF") : Theme.hex("#FAFBFD"));
                g.fill(box);
                g.setColor(d.filled ? Theme.hex("#C9D7FB") : Theme.BORDER);
                Theme.stroke(g, 1f);
                g.draw(box);
                if (d.filled) {
                    g.setFont(Theme.font(13f));
                    g.setColor(INK_BLUE);
                    g.drawString(str(f, "value"), M + 12, y + 27);
                }
                y += 54;
            }
            y += 4;
        }

        void signature(List<Object> signers) {
            y = Math.max(y + 24, PH - 150);
            int n = signers.size();
            int gap = 40;
            int sw = (width - gap * (n - 1)) / n;
            for (int k = 0; k < n; k++) {
                int x = M + k * (sw + gap);
                int line = y + 56;
                if (d.signed && (k == n - 1 || n == 1 || isOwn(String.valueOf(signers.get(k))))) {
                    scribble(x + 8, line - 6, Math.min(sw - 20, 170));
                } else if (d.signed) {
                    scribble(x + 14, line - 6, Math.min(sw - 30, 140));
                }
                g.setColor(scan ? text : Theme.FAINT);
                g.fill(new Rectangle2D.Double(x, line, sw, 1.2));
                g.setFont(Theme.font(11.5f));
                g.setColor(scan ? text : Theme.MUTED);
                g.drawString(String.valueOf(signers.get(k)), x, line + 18);
            }
            if (d.signed) {
                g.setFont(Theme.bold(10.5f));
                String t = "Potpisano elektronski · " + app.profile.name;
                FontMetrics fm = g.getFontMetrics();
                int tw = fm.stringWidth(t) + 22;
                g.setColor(Theme.hex("#E6F4EA"));
                g.fill(new RoundRectangle2D.Double(M, y + 88, tw, 22, 22, 22));
                g.setColor(Theme.hex("#0D652D"));
                g.drawString(t, M + 11, y + 103);
            }
            y += 120;
        }

        boolean isOwn(String signer) { return signer.contains(app.profile.name); }

        void scribble(int x, int base, int w) {
            Path2D p = new Path2D.Double();
            p.moveTo(x, base);
            double seg = w / 6.0;
            p.curveTo(x + seg * 0.4, base - 34, x + seg * 0.9, base - 6, x + seg * 1.1, base - 18);
            p.curveTo(x + seg * 1.4, base - 36, x + seg * 1.6, base + 4, x + seg * 2.2, base - 14);
            p.curveTo(x + seg * 2.8, base - 30, x + seg * 3.0, base, x + seg * 3.6, base - 10);
            p.curveTo(x + seg * 4.2, base - 22, x + seg * 4.6, base - 2, x + seg * 5.2, base - 12);
            p.curveTo(x + seg * 5.5, base - 16, x + seg * 5.8, base - 8, x + w, base - 20);
            g.setColor(INK_BLUE);
            Theme.stroke(g, 2.1f);
            AffineTransform old = g.getTransform();
            g.draw(p);
            g.setTransform(old);
        }
    }

    static List<String> wrap(String text, FontMetrics fm, int width) {
        List<String> out = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String w : text.split(" ")) {
            String test = line.length() == 0 ? w : line + " " + w;
            if (fm.stringWidth(test) <= width) line = new StringBuilder(test);
            else { out.add(line.toString()); line = new StringBuilder(w); }
        }
        if (line.length() > 0) out.add(line.toString());
        return out;
    }
}
