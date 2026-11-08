package folio;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.geom.RoundRectangle2D;
import java.util.ArrayList;
import java.util.List;
import javax.swing.JComponent;

/** Right panel: which features this profile uses, and which it never touches. */
public class Insights extends JComponent {
    public static final int PANEL_W = 320;
    private final App app;

    public Insights(App app) {
        this.app = app;
        setPreferredSize(new Dimension(PANEL_W, 800));
    }

    @Override protected void paintComponent(Graphics g) {
        Graphics2D g2 = Theme.smooth(g);
        int w = getWidth(), h = getHeight();
        g2.setColor(Theme.BG);
        g2.fillRect(0, 0, w, h);
        g2.setColor(Theme.GRID);
        g2.fillRect(0, 0, 1, h);

        Model.Profile p = app.profile;
        int x = 22, cw = w - 44, y = 36;

        g2.setFont(Theme.bold(17f));
        g2.setColor(Theme.TEXT);
        g2.drawString("How they use the PDF tool", x, y);
        y += 20;
        g2.setFont(Theme.font(12f));
        g2.setColor(Theme.MUTED);
        g2.drawString("Last 30 days · " + p.role, x, y);
        y += 16;

        // most used feature (not counting reading)
        Model.Feature top = null;
        int total = 0;
        for (Model.Feature f : Model.FEATURES) {
            total += p.count(f.id);
            if (f.id.equals("read")) continue;
            if (top == null || p.count(f.id) > p.count(top.id)) top = f;
        }
        // Summary as a sentence, not as cards with big numbers.
        y += 16;
        g2.setFont(Theme.font(14f));
        g2.setColor(Theme.TEXT);
        g2.drawString(p.count("read") + " opens · " + (total - p.count("read")) + " tool uses", x, y);
        y += 26;
        if (top != null) {
            g2.setFont(Theme.font(14f));
            FontMetrics fm = g2.getFontMetrics();
            String lead = "Most used: ";
            g2.drawString(lead, x, y);
            int lx = x + fm.stringWidth(lead);
            g2.setFont(Theme.bold(14f));
            fm = g2.getFontMetrics();
            String name = top.name + ", " + p.count(top.id) + "×";
            Theme.marker(g2, lx - 4, y - 15, fm.stringWidth(name) + 8, 20);
            g2.setColor(Theme.TEXT);
            g2.drawString(name, lx, y);
        }
        y += 30;
        g2.setColor(Theme.GRID);
        g2.fillRect(x, y, cw, 1);
        y += 28;

        // one bar per feature
        g2.setFont(Theme.bold(13.5f));
        g2.setColor(Theme.TEXT);
        g2.drawString("Tools they use", x, y);
        y += 18;
        List<Model.Feature> used = new ArrayList<>(), never = new ArrayList<>();
        int max = 1;
        for (Model.Feature f : Model.FEATURES) {
            if (f.id.equals("read")) continue;
            if (p.count(f.id) > 0) { used.add(f); max = Math.max(max, p.count(f.id)); } else never.add(f);
        }
        used.sort((a, b) -> p.count(b.id) - p.count(a.id));
        int labelW = 104, numW = 36;
        double barMax = cw - labelW - numW;
        int shown = 0;
        for (Model.Feature f : used) {
            if (shown >= 8) break;
            int c = p.count(f.id);
            g2.setColor(Theme.MUTED);
            Widgets.paintIcon(g2, f.icon, x + 8, y + 7, 13);
            g2.setFont(Theme.font(12.5f));
            g2.setColor(Theme.TEXT);
            g2.drawString(f.name, x + 24, y + 12);
            double bw = Math.max(4, barMax * c / (double) max);
            // The most used tool gets the marker; the rest are grey ink.
            g2.setColor(shown == 0 ? Theme.MARKER : Theme.hex("#BDBDBD"));
            g2.fill(new RoundRectangle2D.Double(x + labelW, y + 2, bw, 11, 3, 3));
            if (shown == 0) {
                g2.setColor(Theme.TEXT);
                Theme.stroke(g2, 1f);
                g2.draw(new RoundRectangle2D.Double(x + labelW, y + 2, bw, 11, 3, 3));
            }
            g2.setFont(Theme.bold(12f));
            g2.setColor(Theme.TEXT);
            String n = String.valueOf(c);
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(n, x + cw - fm.stringWidth(n), y + 12);
            y += 26;
            shown++;
        }

        // never used
        y += 14;
        g2.setFont(Theme.bold(13.5f));
        g2.setColor(Theme.TEXT);
        g2.drawString("Never used", x, y);
        y += 14;
        if (never.isEmpty()) {
            g2.setFont(Theme.font(12.5f));
            g2.setColor(Theme.MUTED);
            g2.drawString("Uses every tool.", x, y + 14);
        }
        int cx = x;
        g2.setFont(Theme.bold(12f));
        FontMetrics fm = g2.getFontMetrics();
        for (Model.Feature f : never) {
            int chipW = fm.stringWidth(f.name) + 40;
            if (cx + chipW > x + cw) { cx = x; y += 36; }
            RoundRectangle2D chip = new RoundRectangle2D.Double(cx, y, chipW, 28, 28, 28);
            g2.setColor(Theme.BG);
            g2.fill(chip);
            g2.setColor(Theme.BORDER);
            float[] dash = { 4f, 3f };
            g2.setStroke(new java.awt.BasicStroke(1.2f, java.awt.BasicStroke.CAP_ROUND, java.awt.BasicStroke.JOIN_ROUND, 1f, dash, 0f));
            g2.draw(chip);
            g2.setColor(Theme.FAINT);
            Widgets.paintIcon(g2, f.icon, cx + 15, y + 14, 12);
            g2.setColor(Theme.MUTED);
            g2.drawString(f.name, cx + 28, y + 18);
            cx += chipW + 8;
        }
        g2.dispose();
    }
}
