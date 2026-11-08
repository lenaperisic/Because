package folio;

import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;

/** Left column: profile, open button and document list. */
public class Sidebar extends JPanel {
    public static final int SIDE_W = 300;
    private final App app;
    private final ProfileCard card = new ProfileCard();
    private final DocList list = new DocList();
    private final Queue queue = new Queue();
    private final Widgets.Pill open;

    public Sidebar(App app) {
        this.app = app;
        setBackground(Theme.SIDEBAR);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(new EmptyBorder(14, 18, 18, 18));
        setPreferredSize(new Dimension(SIDE_W, 800));

        add(left(card));
        add(Box.createVerticalStrut(14));
        open = new Widgets.Pill("Open PDF", Widgets.Kind.PRIMARY).color(Theme.TEXT).icon(Widgets.Icon.UPLOAD);
        open.setFont(Theme.bold(14f));
        open.setBorder(new EmptyBorder(14, 24, 14, 26));
        open.addActionListener(e -> app.toast("Demo: documents are already loaded from JSON"));
        JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        row.setOpaque(false);
        row.add(open);
        row.setMaximumSize(new Dimension(SIDE_W - 36, open.getPreferredSize().height));
        add(left(row));
        add(Box.createVerticalStrut(18));
        add(left(list));
        add(Box.createVerticalStrut(10));
        add(left(queue));
        add(Box.createVerticalGlue());
    }

    private static JComponent left(JComponent c) {
        c.setAlignmentX(Component.LEFT_ALIGNMENT);
        return c;
    }

    public void refresh() {
        card.repaint();
        list.revalidate();
        list.repaint();
        queue.repaint();
    }

    private class ProfileCard extends JComponent {
        ProfileCard() {
            setPreferredSize(new Dimension(SIDE_W - 36, 56));
            setMaximumSize(new Dimension(SIDE_W - 36, 56));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            Model.Profile p = app.profile;
            Widgets.avatar(g2, p.initials(), Theme.TEXT, 0, 6, 44);
            g2.setFont(Theme.bold(15f));
            g2.setColor(Theme.TEXT);
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(Theme.fit(p.name, fm, getWidth() - 58), 56, 25);
            g2.setFont(Theme.font(12f));
            g2.setColor(Theme.MUTED);
            fm = g2.getFontMetrics();
            g2.drawString(Theme.fit(p.title, fm, getWidth() - 58), 56, 44);
            g2.dispose();
        }
    }

    /** Document list with a file icon, name and status. */
    private class DocList extends JComponent {
        static final int ROW = 66, HEAD = 30;

        DocList() {
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            addMouseListener(new MouseAdapter() {
                @Override public void mouseClicked(MouseEvent e) {
                    int k = (e.getY() - HEAD) / ROW;
                    if (e.getY() >= HEAD && k >= 0 && k < app.profile.docs.size()) app.openDoc(app.profile.docs.get(k));
                }
            });
        }

        @Override public Dimension getPreferredSize() {
            return new Dimension(SIDE_W - 36, HEAD + ROW * app.profile.docs.size());
        }

        @Override public Dimension getMaximumSize() { return getPreferredSize(); }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            int w = getWidth();
            g2.setFont(Theme.bold(13.5f));
            g2.setColor(Theme.TEXT);
            g2.drawString("Recent documents", 4, 18);
            int y = HEAD;
            for (Model.Doc d : app.profile.docs) {
                boolean sel = d == app.doc;
                if (sel) {
                    // Open document: white card with a thin black outline, no shadow or side bar.
                    RoundRectangle2D row = new RoundRectangle2D.Double(0.5, y + 2.5, w - 1, ROW - 7, 10, 10);
                    g2.setColor(Theme.BG);
                    g2.fill(row);
                    g2.setColor(Theme.TEXT);
                    Theme.stroke(g2, 1.2f);
                    g2.draw(row);
                }
                fileIcon(g2, 14, y + 13, d);
                g2.setFont(Theme.bold(13f));
                g2.setColor(Theme.TEXT);
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(Theme.fit(d.name.replace(".pdf", ""), fm, w - 66), 54, y + 27);
                g2.setFont(Theme.font(11.5f));
                g2.setColor(Theme.MUTED);
                fm = g2.getFontMetrics();
                String meta = d.pages + (d.pages == 1 ? " p." : " pp.") + " · " + d.size + " · " + d.updated;
                String badge = d.needsSignature() ? "To sign" : d.needsOcr() ? "Scan" : (d.has("form") && !d.filled) ? "To fill" : null;
                int badgeW = 0;
                if (badge != null) {
                    g2.setFont(Theme.bold(10f));
                    FontMetrics bf = g2.getFontMetrics();
                    badgeW = bf.stringWidth(badge) + 14;
                    RoundRectangle2D b = new RoundRectangle2D.Double(w - badgeW - 4, y + 34, badgeW, 18, 5, 5);
                    if (d.needsOcr()) {
                        // Scan: a notice, not a task, so outline only.
                        g2.setColor(Theme.MUTED);
                        Theme.stroke(g2, 1f);
                        g2.draw(b);
                        g2.setColor(Theme.MUTED);
                    } else {
                        // Waiting on the user: marker.
                        g2.setColor(Theme.MARKER);
                        g2.fill(b);
                        g2.setColor(Theme.TEXT);
                    }
                    g2.drawString(badge, w - badgeW + 3, y + 47);
                    g2.setFont(Theme.font(11.5f));
                }
                g2.setColor(Theme.MUTED);
                g2.drawString(Theme.fit(meta, fm, w - 62 - badgeW - 8), 54, y + 46);
                y += ROW;
            }
            g2.dispose();
        }

        void fileIcon(Graphics2D g2, double x, double y, Model.Doc d) {
            Path2D p = new Path2D.Double();
            p.moveTo(x, y + 4);
            p.quadTo(x, y, x + 4, y);
            p.lineTo(x + 20, y);
            p.lineTo(x + 28, y + 8);
            p.lineTo(x + 28, y + 32);
            p.quadTo(x + 28, y + 36, x + 24, y + 36);
            p.lineTo(x + 4, y + 36);
            p.quadTo(x, y + 36, x, y + 32);
            p.closePath();
            // Sheet of paper: white with a black outline and a folded corner; the document type goes in text, not color.
            g2.setColor(Theme.BG);
            g2.fill(p);
            g2.setColor(Theme.TEXT);
            Theme.stroke(g2, 1.2f);
            g2.draw(p);
            Path2D fold = new Path2D.Double();
            fold.moveTo(x + 20, y);
            fold.lineTo(x + 20, y + 8);
            fold.lineTo(x + 28, y + 8);
            g2.draw(fold);
            g2.setFont(Theme.bold(8.5f));
            g2.drawString("PDF", (float) x + 4, (float) y + 28);
        }
    }

    /** Quick counts: what is waiting on this user. */
    private class Queue extends JComponent {
        Queue() {
            setPreferredSize(new Dimension(SIDE_W - 36, 120));
            setMaximumSize(new Dimension(SIDE_W - 36, 120));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            int sign = 0, scan = 0, forms = 0;
            for (Model.Doc d : app.profile.docs) {
                if (d.needsSignature()) sign++;
                if (d.needsOcr()) scan++;
                if (d.has("form") && !d.filled) forms++;
            }
            g2.setFont(Theme.bold(13.5f));
            g2.setColor(Theme.TEXT);
            g2.drawString("Waiting on me", 4, 18);
            String[][] rows = { { "To sign", String.valueOf(sign) }, { "To fill in", String.valueOf(forms) },
                    { "Scans without text", String.valueOf(scan) } };
            int y = 44;
            for (String[] r : rows) {
                g2.setFont(Theme.font(13f));
                g2.setColor(Theme.MUTED);
                g2.drawString(r[0], 4, y);
                g2.setFont(Theme.bold(13f));
                FontMetrics fm = g2.getFontMetrics();
                int nx = getWidth() - 8 - fm.stringWidth(r[1]);
                boolean waiting = !"0".equals(r[1]);
                if (waiting) Theme.marker(g2, nx - 7, y - 14, fm.stringWidth(r[1]) + 14, 19);
                g2.setColor(waiting ? Theme.TEXT : Theme.FAINT);
                g2.drawString(r[1], nx, y);
                y += 26;
            }
            g2.dispose();
        }
    }
}
