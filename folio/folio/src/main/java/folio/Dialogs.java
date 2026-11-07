package folio;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.event.KeyEvent;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.util.List;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLayeredPane;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.Timer;
import javax.swing.border.EmptyBorder;

/** Prozorčići unutar glavnog prozora: AI sažetak, poređenje verzija i kratka obaveštenja. */
public final class Dialogs {
    private Dialogs() {}

    private static final int MARGIN = 18;

    static class Card extends JPanel {
        Card() {
            setOpaque(false);
            setBorder(new EmptyBorder(MARGIN + 20, MARGIN + 26, MARGIN + 22, MARGIN + 26));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            double w = getWidth() - MARGIN * 2, h = getHeight() - MARGIN * 2;
            Theme.shadow(g2, MARGIN, MARGIN, w, h, 24, 14, 90);
            g2.setColor(Theme.BG);
            g2.fill(new RoundRectangle2D.Double(MARGIN, MARGIN, w, h, 24, 24));
            g2.dispose();
        }
    }

    /** Zatamnjena pozadina sa karticom u sredini. */
    static final class Overlay extends JPanel {
        private final JFrame frame;
        private final java.awt.event.ComponentAdapter resizer;

        Overlay(JFrame frame, JComponent body) {
            super(new java.awt.GridBagLayout());
            this.frame = frame;
            setOpaque(false);
            Card card = new Card();
            card.setLayout(new BorderLayout());
            card.add(body);
            add(card);
            addMouseListener(new java.awt.event.MouseAdapter() {
                @Override public void mousePressed(java.awt.event.MouseEvent e) {
                    if (!card.getBounds().contains(e.getPoint())) close();
                }
            });
            addMouseMotionListener(new java.awt.event.MouseMotionAdapter() {});
            registerKeyboardAction(e -> close(), KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0),
                    JComponent.WHEN_IN_FOCUSED_WINDOW);
            resizer = new java.awt.event.ComponentAdapter() {
                @Override public void componentResized(java.awt.event.ComponentEvent e) {
                    setBounds(0, 0, frame.getLayeredPane().getWidth(), frame.getLayeredPane().getHeight());
                    revalidate();
                }
            };
        }

        void open() {
            JLayeredPane lp = frame.getLayeredPane();
            setBounds(0, 0, lp.getWidth(), lp.getHeight());
            lp.add(this, JLayeredPane.MODAL_LAYER);
            lp.addComponentListener(resizer);
            revalidate();
            repaint();
        }

        void close() {
            JLayeredPane lp = frame.getLayeredPane();
            lp.removeComponentListener(resizer);
            lp.remove(this);
            lp.repaint();
        }

        @Override protected void paintComponent(Graphics g) {
            g.setColor(new Color(17, 24, 39, 70));
            g.fillRect(0, 0, getWidth(), getHeight());
        }
    }

    private static JPanel column() {
        JPanel p = new JPanel();
        p.setOpaque(false);
        p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        return p;
    }

    private static JComponent header(Widgets.Icon icon, Color color, String title, String sub, Runnable close) {
        JPanel row = new JPanel(new BorderLayout());
        row.setOpaque(false);
        row.setAlignmentX(Component.LEFT_ALIGNMENT);
        JComponent t = new JComponent() {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = Theme.smooth(g);
                g2.setColor(Theme.mix(color, Color.WHITE, 0.85));
                g2.fill(new Ellipse2D.Double(0, 2, 40, 40));
                g2.setColor(color);
                Widgets.paintIcon(g2, icon, 20, 22, 18);
                g2.setFont(Theme.bold(19f));
                g2.setColor(Theme.TEXT);
                g2.drawString(title, 54, 20);
                g2.setFont(Theme.font(13f));
                g2.setColor(Theme.MUTED);
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(Theme.fit(sub, fm, getWidth() - 60), 54, 39);
                g2.dispose();
            }
        };
        t.setPreferredSize(new Dimension(440, 46));
        row.add(t, BorderLayout.CENTER);
        Widgets.IconButton x = new Widgets.IconButton(Widgets.Icon.CLOSE, "Zatvori");
        x.addActionListener(e -> close.run());
        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        right.setOpaque(false);
        right.add(x);
        row.add(right, BorderLayout.EAST);
        row.setMaximumSize(new Dimension(Integer.MAX_VALUE, 50));
        return row;
    }

    /** AI sažetak dokumenta. */
    public static void summary(App app, Model.Doc d) {
        JPanel body = column();
        Overlay[] holder = new Overlay[1];
        body.add(header(Widgets.Icon.SPARK, Theme.hex("#A142F4"), "AI sažetak", d.name, () -> holder[0].close()));
        List<String> items = d.summary;
        JComponent list = new JComponent() {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = Theme.smooth(g);
                int y = 18;
                for (String s : items) {
                    g2.setColor(Theme.hex("#A142F4"));
                    g2.fill(new Ellipse2D.Double(4, y - 9, 8, 8));
                    g2.setFont(Theme.font(14.5f));
                    g2.setColor(Theme.TEXT);
                    for (String ln : Page.wrap(s, g2.getFontMetrics(), getWidth() - 30)) {
                        g2.drawString(ln, 24, y);
                        y += 22;
                    }
                    y += 10;
                }
                g2.setFont(Theme.font(12f));
                g2.setColor(Theme.FAINT);
                g2.drawString("Sažetak je napravio AI. Proverite ključne podatke u dokumentu.", 4, y + 6);
                g2.dispose();
            }
        };
        FontMetrics fmList = list.getFontMetrics(Theme.font(14.5f));
        int lines = 0;
        for (String s : items) lines += Page.wrap(s, fmList, 500 - 30).size();
        list.setPreferredSize(new Dimension(500, 18 + lines * 22 + items.size() * 10 + 4));
        list.setAlignmentX(Component.LEFT_ALIGNMENT);
        list.setBorder(new EmptyBorder(14, 0, 0, 0));
        body.add(javax.swing.Box.createVerticalStrut(14));
        body.add(list);
        holder[0] = new Overlay(app.frame, body);
        holder[0].open();
    }

    /** Poređenje sa prethodnom verzijom. */
    public static void compare(App app, Model.Doc d) {
        JPanel body = column();
        Overlay[] holder = new Overlay[1];
        body.add(header(Widgets.Icon.COMPARE, Theme.hex("#4285F4"), "Poređenje sa prethodnom verzijom",
                d.changes.size() / 2 + " izmene · " + d.name, () -> holder[0].close()));
        JComponent diff = new JComponent() {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = Theme.smooth(g);
                int y = 0;
                for (String[] c : d.changes) {
                    boolean add = "+".equals(c[0]);
                    Color base = add ? Theme.hex("#34A853") : Theme.hex("#EA4335");
                    g2.setColor(Theme.mix(base, Color.WHITE, 0.88));
                    g2.fill(new RoundRectangle2D.Double(0, y, getWidth(), 40, 10, 10));
                    g2.setColor(base);
                    g2.fill(new RoundRectangle2D.Double(0, y, 4, 40, 4, 4));
                    g2.setFont(Theme.bold(16f));
                    g2.setColor(Theme.ink(base));
                    g2.drawString(add ? "+" : "−", 16, y + 26);
                    g2.setFont(Theme.font(13.5f));
                    FontMetrics fm = g2.getFontMetrics();
                    g2.drawString(Theme.fit(c[1], fm, getWidth() - 56), 40, y + 25);
                    y += 48;
                }
                g2.dispose();
            }
        };
        diff.setPreferredSize(new Dimension(560, d.changes.size() * 48));
        diff.setAlignmentX(Component.LEFT_ALIGNMENT);
        body.add(javax.swing.Box.createVerticalStrut(18));
        body.add(diff);
        holder[0] = new Overlay(app.frame, body);
        holder[0].open();
    }

    /** Kratko obaveštenje na dnu prozora. */
    public static void toast(JFrame frame, String text) {
        JLayeredPane lp = frame.getLayeredPane();
        JComponent t = new JComponent() {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = Theme.smooth(g);
                g2.setColor(new Color(27, 33, 48, 238));
                g2.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), getHeight(), getHeight()));
                g2.setColor(Theme.hex("#7CD99A"));
                g2.fill(new Ellipse2D.Double(18, getHeight() / 2.0 - 4, 8, 8));
                g2.setFont(Theme.bold(13.5f));
                g2.setColor(Color.WHITE);
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(text, 36, (getHeight() - fm.getHeight()) / 2 + fm.getAscent());
                g2.dispose();
            }
        };
        int tw = t.getFontMetrics(Theme.bold(13.5f)).stringWidth(text) + 58;
        t.setBounds((lp.getWidth() - tw) / 2, lp.getHeight() - 84, tw, 44);
        for (Component c : lp.getComponentsInLayer(JLayeredPane.POPUP_LAYER)) {
            if ("toast".equals(c.getName())) lp.remove(c);
        }
        t.setName("toast");
        lp.add(t, JLayeredPane.POPUP_LAYER);
        lp.repaint();
        Timer timer = new Timer(2600, e -> { lp.remove(t); lp.repaint(); });
        timer.setRepeats(false);
        timer.start();
    }
}
