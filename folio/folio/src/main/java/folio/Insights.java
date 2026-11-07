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

/** Desni panel: koje funkcije ovaj profil koristi, a koje nikad. */
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
        g2.setColor(Theme.SIDEBAR);
        g2.fillRect(0, 0, w, h);
        g2.setColor(Theme.GRID);
        g2.fillRect(0, 0, 1, h);

        Model.Profile p = app.profile;
        Color pc = p.color;
        int x = 22, cw = w - 44, y = 36;

        g2.setFont(Theme.bold(17f));
        g2.setColor(Theme.TEXT);
        g2.drawString("Kako koristi PDF alat", x, y);
        y += 20;
        g2.setFont(Theme.font(12f));
        g2.setColor(Theme.MUTED);
        g2.drawString("Poslednjih 30 dana · " + p.role, x, y);
        y += 16;

        // najkorišćenija funkcija (bez čitanja)
        Model.Feature top = null;
        int total = 0;
        for (Model.Feature f : Model.FEATURES) {
            total += p.count(f.id);
            if (f.id.equals("read")) continue;
            if (top == null || p.count(f.id) > p.count(top.id)) top = f;
        }
        String[][] tiles = {
                { String.valueOf(p.count("read")), "otvaranja" },
                { String.valueOf(total - p.count("read")), "upotreba alata" },
                { String.valueOf(p.count("sign")), "potpisa" },
                { top == null ? "—" : top.name, "najčešći alat" } };
        double tw = (cw - 10) / 2.0;
        for (int k = 0; k < 4; k++) {
            double tx = x + (k % 2) * (tw + 10), ty = y + (k / 2) * 70;
            Theme.shadow(g2, tx, ty, tw, 60, 14, 4, 26);
            g2.setColor(Theme.BG);
            g2.fill(new RoundRectangle2D.Double(tx, ty, tw, 60, 14, 14));
            g2.setColor(k == 3 ? pc : Theme.TEXT);
            g2.setFont(Theme.bold(k == 3 ? 17f : 21f));
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(Theme.fit(tiles[k][0], fm, (int) tw - 24), (float) tx + 14, (float) ty + 30);
            g2.setFont(Theme.font(11.5f));
            g2.setColor(Theme.MUTED);
            g2.drawString(tiles[k][1], (float) tx + 14, (float) ty + 48);
        }
        y += 158;

        // trake po funkciji
        g2.setFont(Theme.bold(13.5f));
        g2.setColor(Theme.TEXT);
        g2.drawString("Alati koje koristi", x, y);
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
            g2.setColor(Theme.alpha(pc, shown == 0 ? 255 : 120));
            g2.fill(new RoundRectangle2D.Double(x + labelW, y + 2, bw, 11, 11, 11));
            g2.setFont(Theme.bold(12f));
            g2.setColor(Theme.TEXT);
            String n = String.valueOf(c);
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(n, x + cw - fm.stringWidth(n), y + 12);
            y += 26;
            shown++;
        }

        // nikad korišćeno
        y += 14;
        g2.setFont(Theme.bold(13.5f));
        g2.setColor(Theme.TEXT);
        g2.drawString("Nikad nije koristio", x, y);
        y += 14;
        if (never.isEmpty()) {
            g2.setFont(Theme.font(12.5f));
            g2.setColor(Theme.MUTED);
            g2.drawString("Koristi sve alate.", x, y + 14);
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
