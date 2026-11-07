package folio;

import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.geom.RoundRectangle2D;
import javax.swing.JComponent;

/** Tanak, zaobljen skrolbar. */
public class ThinScrollBarUI extends javax.swing.plaf.basic.BasicScrollBarUI {
    @Override protected void configureScrollBarColors() {
        thumbColor = Theme.GRID;
        trackColor = Theme.BG;
    }

    @Override protected javax.swing.JButton createDecreaseButton(int o) { return zero(); }
    @Override protected javax.swing.JButton createIncreaseButton(int o) { return zero(); }

    private javax.swing.JButton zero() {
        javax.swing.JButton b = new javax.swing.JButton();
        b.setPreferredSize(new Dimension(0, 0));
        return b;
    }

    @Override protected void paintTrack(Graphics g, JComponent c, Rectangle r) {
        g.setColor(Theme.BG);
        g.fillRect(r.x, r.y, r.width, r.height);
    }

    @Override protected void paintThumb(Graphics g, JComponent c, Rectangle r) {
        Graphics2D g2 = Theme.smooth(g);
        g2.setColor(isThumbRollover() ? Theme.FAINT : Theme.BORDER);
        g2.fill(new RoundRectangle2D.Double(r.x + 2, r.y + 2, r.width - 4, r.height - 4, 8, 8));
        g2.dispose();
    }
}
