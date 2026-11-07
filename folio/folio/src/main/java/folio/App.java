package folio;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.Robot;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.ToolTipManager;
import javax.swing.UIManager;
import javax.swing.border.EmptyBorder;
import javax.swing.border.MatteBorder;

/** Folio: demo PDF alat sa tri profila (developer, lekar, bankar) koji ga koriste potpuno različito. */
public class App {
    final JFrame frame = new JFrame("Folio");
    Model.Profile profile;
    Model.Doc doc;

    private final Sidebar sidebar;
    private final Insights insights;
    private final Page page;
    private final TopBar top;
    private final DocHeader docHeader = new DocHeader();
    private final List<ToolButton> tools = new ArrayList<>();
    private final JScrollPane scroll;

    App(String profileId) {
        profile = Model.load(profileId);
        doc = profile.docs.isEmpty() ? null : profile.docs.get(0);
        sidebar = new Sidebar(this);
        insights = new Insights(this);
        page = new Page(this);
        top = new TopBar();

        JPanel toolbar = new JPanel(new FlowLayout(FlowLayout.CENTER, 2, 6));
        toolbar.setBackground(Theme.BG);
        for (Model.Feature f : Model.FEATURES) {
            if (f.id.equals("read")) continue;
            ToolButton b = new ToolButton(f);
            b.addActionListener(e -> use(f.id));
            tools.add(b);
            toolbar.add(b);
        }
        JPanel head = new JPanel();
        head.setLayout(new BoxLayout(head, BoxLayout.Y_AXIS));
        head.setBackground(Theme.BG);
        head.setBorder(new MatteBorder(0, 0, 1, 0, Theme.GRID));
        head.add(docHeader);
        head.add(toolbar);

        scroll = new JScrollPane(page);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.getVerticalScrollBar().setUnitIncrement(20);
        scroll.getVerticalScrollBar().setPreferredSize(new Dimension(10, 0));
        scroll.getVerticalScrollBar().setUI(new ThinScrollBarUI());
        scroll.getHorizontalScrollBar().setUI(new ThinScrollBarUI());
        page.setFocusable(true);

        JPanel center = new JPanel(new BorderLayout());
        center.add(head, BorderLayout.NORTH);
        center.add(scroll, BorderLayout.CENTER);

        JPanel root = new JPanel(new BorderLayout());
        root.setBackground(Theme.BG);
        root.add(top, BorderLayout.NORTH);
        root.add(sidebar, BorderLayout.WEST);
        root.add(center, BorderLayout.CENTER);
        root.add(insights, BorderLayout.EAST);
        frame.setContentPane(root);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setMinimumSize(new Dimension(1280, 780));
        frame.setSize(1500, 940);
        frame.setLocationRelativeTo(null);
        refreshAll();
        Tracker.identify(profile);
        Tracker.track("app_opened", profile);
    }

    // ---------------- akcije ----------------

    void refreshAll() {
        frame.setTitle("Folio · " + profile.name);
        top.refresh();
        sidebar.refresh();
        docHeader.repaint();
        for (ToolButton b : tools) b.repaint();
        page.revalidate();
        page.repaint();
        insights.repaint();
    }

    void setProfile(String id) {
        if (profile.id.equals(id)) return;
        profile = Model.load(id);
        doc = profile.docs.isEmpty() ? null : profile.docs.get(0);
        Tracker.identify(profile);
        Tracker.track("profile_switched", profile, "to", id);
        SwingUtilities.invokeLater(() -> scroll.getVerticalScrollBar().setValue(0));
        refreshAll();
    }

    void openDoc(Model.Doc d) {
        if (d == doc) return;
        doc = d;
        profile.bump("read");
        Model.save(profile);
        Tracker.track("document_opened", profile, "doc_kind", d.kind, "pages", d.pages);
        SwingUtilities.invokeLater(() -> scroll.getVerticalScrollBar().setValue(0));
        refreshAll();
    }

    void toast(String text) { Dialogs.toast(frame, text); }

    /** 1 strana, 2–4 strane, 5+ strana (i 21 strana, 22 strane...). */
    static String pagesLabel(int n) {
        int m10 = n % 10, m100 = n % 100;
        String w = (m10 == 1 && m100 != 11) ? "strana" : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? "strane" : "strana";
        return n + " " + w;
    }

    /** Korisnik je kliknuo na alat: izbroj, pošalji događaj i promeni dokument. */
    void use(String feature) {
        if (doc == null) return;
        Model.Doc d = doc;
        profile.bump(feature);
        Tracker.track("feature_used", profile, "feature", feature, "doc_kind", d.kind);
        String base = d.name.replace(".pdf", "");
        switch (feature) {
            case "search":
                toast("Pretraga: 7 rezultata u dokumentu „" + base + "“");
                break;
            case "annotate":
                d.annotated = !d.annotated;
                toast(d.annotated ? "Komentar dodat na stranu 1" : "Komentar uklonjen");
                break;
            case "sign":
                if (!d.has("signature")) toast("Ovaj dokument nema polje za potpis");
                else if (d.signed) toast("Dokument je već potpisan");
                else { d.signed = true; toast("Dokument je potpisan elektronski"); }
                break;
            case "fill_form":
                if (!d.has("form")) toast("Ovaj dokument nema polja za popunjavanje");
                else if (d.filled) toast("Formular je već popunjen");
                else { d.filled = true; toast("Formular popunjen sa 6 polja"); }
                break;
            case "ocr":
                if (!d.scanned) toast("Dokument već ima tekst koji se može pretraživati");
                else if (d.ocr) toast("Tekst je već prepoznat");
                else { d.ocr = true; toast("Prepoznat tekst na " + d.pages + (d.pages == 1 ? " strani" : " strana")); }
                break;
            case "redact":
                if (!d.hasSensitive()) toast("U dokumentu nema ličnih podataka za zacrnjivanje");
                else { d.redacted = !d.redacted; toast(d.redacted ? "Lični podaci su zacrnjeni" : "Zacrnjivanje uklonjeno"); }
                break;
            case "compare":
                if (d.changes.isEmpty()) toast("Nema prethodne verzije za poređenje");
                else Dialogs.compare(this, d);
                break;
            case "merge":
                toast("Spojeno: „" + base + "“ i još 2 dokumenta u Dosije.pdf");
                break;
            case "compress":
                toast("Veličina smanjena sa " + d.size + " za 61%");
                break;
            case "export_text":
                toast("Izvezeno u " + base + ".md");
                break;
            case "ai_summary":
                Dialogs.summary(this, d);
                break;
            default:
                break;
        }
        Model.save(profile);
        refreshAll();
    }

    // ---------------- dugme alata ----------------

    private class ToolButton extends JButton {
        final Model.Feature f;

        ToolButton(Model.Feature f) {
            this.f = f;
            setToolTipText(f.name);
            setContentAreaFilled(false);
            setBorderPainted(false);
            setFocusPainted(false);
            setOpaque(false);
            setRolloverEnabled(true);
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            setPreferredSize(new Dimension(72, 60));
        }

        boolean active() {
            if (doc == null) return false;
            switch (f.id) {
                case "sign": return doc.signed && doc.has("signature");
                case "fill_form": return doc.filled;
                case "ocr": return doc.scanned && doc.ocr;
                case "redact": return doc.redacted;
                case "annotate": return doc.annotated;
                default: return false;
            }
        }

        boolean attention() {
            if (doc == null) return false;
            switch (f.id) {
                case "sign": return doc.needsSignature();
                case "fill_form": return doc.has("form") && !doc.filled;
                case "ocr": return doc.needsOcr();
                case "redact": return doc.hasSensitive() && !doc.redacted;
                default: return false;
            }
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            int w = getWidth(), h = getHeight();
            boolean ai = f.id.equals("ai_summary");
            Color pc = ai ? Theme.hex("#A142F4") : profile.color;
            RoundRectangle2D bg = new RoundRectangle2D.Double(2, 2, w - 4, h - 4, 14, 14);
            if (active()) { g2.setColor(Theme.mix(pc, Color.WHITE, 0.84)); g2.fill(bg); }
            else if (getModel().isRollover()) { g2.setColor(Theme.HOVER); g2.fill(bg); }
            g2.setColor(active() || ai ? Theme.ink(pc) : Theme.MUTED);
            Widgets.paintIcon(g2, f.icon, w / 2.0, 22, 18);
            if (attention()) {
                g2.setColor(Theme.hex("#F29900"));
                g2.fill(new java.awt.geom.Ellipse2D.Double(w / 2.0 + 10, 8, 8, 8));
                g2.setColor(Theme.BG);
                Theme.stroke(g2, 1.5f);
                g2.draw(new java.awt.geom.Ellipse2D.Double(w / 2.0 + 10, 8, 8, 8));
            }
            g2.setFont(Theme.bold(11f));
            g2.setColor(active() || ai ? Theme.ink(pc) : Theme.TEXT);
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(f.name, (w - fm.stringWidth(f.name)) / 2f, 48);
            g2.dispose();
        }
    }

    // ---------------- naslov dokumenta ----------------

    private class DocHeader extends JComponent {
        DocHeader() {
            setPreferredSize(new Dimension(800, 62));
            setMaximumSize(new Dimension(Integer.MAX_VALUE, 62));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = Theme.smooth(g);
            int w = getWidth();
            g2.setColor(Theme.BG);
            g2.fillRect(0, 0, w, getHeight());
            if (doc == null) { g2.dispose(); return; }
            int x = 28;
            g2.setFont(Theme.bold(12f));
            FontMetrics fm = g2.getFontMetrics();
            int kw = fm.stringWidth(doc.kind) + 20;
            g2.setColor(Theme.mix(doc.color, Color.WHITE, 0.85));
            g2.fill(new RoundRectangle2D.Double(x, 14, kw, 22, 22, 22));
            g2.setColor(Theme.ink(doc.color));
            g2.drawString(doc.kind, x + 10, 29);
            g2.setFont(Theme.bold(17f));
            g2.setColor(Theme.TEXT);
            fm = g2.getFontMetrics();
            g2.drawString(Theme.fit(doc.name, fm, w - kw - 260), x + kw + 12, 31);
            g2.setFont(Theme.font(12.5f));
            g2.setColor(Theme.MUTED);
            g2.drawString(pagesLabel(doc.pages) + " · " + doc.size + " · izmenjeno " + doc.updated, x, 54);

            String zoom = "100%";
            g2.setFont(Theme.bold(12.5f));
            fm = g2.getFontMetrics();
            int zx = w - 28 - fm.stringWidth(zoom) - 24;
            g2.setColor(Theme.BORDER);
            Theme.stroke(g2, 1f);
            g2.draw(new RoundRectangle2D.Double(zx, 16, fm.stringWidth(zoom) + 24, 30, 30, 30));
            g2.setColor(Theme.TEXT);
            g2.drawString(zoom, zx + 12, 36);
            String pages = "1 / " + doc.pages;
            int px = zx - 30 - fm.stringWidth(pages) - 48;
            g2.setColor(Theme.MUTED);
            Widgets.paintIcon(g2, Widgets.Icon.LEFT, px + 8, 31, 12);
            g2.setColor(Theme.TEXT);
            g2.drawString(pages, px + 24, 36);
            g2.setColor(Theme.MUTED);
            Widgets.paintIcon(g2, Widgets.Icon.RIGHT, px + 24 + fm.stringWidth(pages) + 16, 31, 12);
            g2.dispose();
        }
    }

    // ---------------- gornja traka ----------------

    private class TopBar extends JPanel {
        final List<Widgets.Pill> profiles = new ArrayList<>();
        final JComponent logo;

        TopBar() {
            super(new BorderLayout());
            setBackground(Theme.BG);
            setBorder(new MatteBorder(0, 0, 1, 0, Theme.GRID));
            setPreferredSize(new Dimension(1200, 72));

            JPanel left = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 16));
            left.setOpaque(false);
            left.setBorder(new EmptyBorder(0, 12, 0, 0));
            logo = new JComponent() {
                @Override protected void paintComponent(Graphics g) {
                    Graphics2D g2 = Theme.smooth(g);
                    Path2D p = new Path2D.Double();
                    p.moveTo(0, 6); p.quadTo(0, 2, 4, 2); p.lineTo(24, 2); p.lineTo(34, 12);
                    p.lineTo(34, 36); p.quadTo(34, 40, 30, 40); p.lineTo(4, 40); p.quadTo(0, 40, 0, 36); p.closePath();
                    g2.setColor(profile.color);
                    g2.fill(p);
                    g2.setColor(Theme.mix(profile.color, Color.WHITE, 0.45));
                    Path2D fold = new Path2D.Double();
                    fold.moveTo(24, 2); fold.lineTo(24, 12); fold.lineTo(34, 12); fold.closePath();
                    g2.fill(fold);
                    g2.setColor(Color.WHITE);
                    g2.setFont(Theme.bold(9.5f));
                    g2.drawString("PDF", 6, 33);
                    g2.setFont(Theme.bold(21f));
                    g2.setColor(Theme.TEXT);
                    g2.drawString("Folio", 46, 29);
                    g2.dispose();
                }
            };
            logo.setPreferredSize(new Dimension(140, 42));
            left.add(logo);
            left.add(Box.createHorizontalStrut(Sidebar.SIDE_W - 190));
            Widgets.Field search = new Widgets.Field("Pretraži dokumente i tekst");
            search.setPreferredSize(new Dimension(380, 40));
            search.addActionListener(e -> use("search"));
            left.add(search);
            add(left, BorderLayout.WEST);

            JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 18));
            right.setOpaque(false);
            right.setBorder(new EmptyBorder(0, 0, 0, 18));
            for (String id : Model.PROFILE_IDS) {
                Model.Profile p = Model.load(id);
                Widgets.Pill pill = new Widgets.Pill(p.role, Widgets.Kind.OUTLINE).color(p.color).dot(p.color);
                pill.setToolTipText(p.name + " · " + p.title);
                pill.putClientProperty("profile", id);
                pill.addActionListener(e -> setProfile(id));
                profiles.add(pill);
                right.add(pill);
            }
            add(right, BorderLayout.EAST);
        }

        void refresh() {
            for (Widgets.Pill p : profiles) p.setSelectedPill(profile.id.equals(p.getClientProperty("profile")));
            logo.repaint();
        }
    }

    // ---------------- pokretanje ----------------

    public static void main(String[] args) {
        System.setProperty("awt.useSystemAAFontSettings", "lcd");
        System.setProperty("swing.aatext", "true");
        try { UIManager.setLookAndFeel(UIManager.getCrossPlatformLookAndFeelClassName()); } catch (Exception ignored) {}
        UIManager.put("ToolTip.background", Theme.TEXT);
        UIManager.put("ToolTip.foreground", Color.WHITE);
        UIManager.put("ToolTip.font", Theme.font(12f));
        UIManager.put("ToolTip.border", new EmptyBorder(6, 10, 6, 10));
        UIManager.put("ScrollBar.thumb", Theme.BORDER);
        ToolTipManager.sharedInstance().setInitialDelay(300);

        String profileId = "developer", shot = null, actions = null;
        int docIndex = 0;
        for (int k = 0; k < args.length; k++) {
            switch (args[k]) {
                case "--profile": profileId = args[++k]; break;
                case "--screenshot": shot = args[++k]; break;
                case "--doc": docIndex = Integer.parseInt(args[++k]); break;
                case "--do": actions = args[++k]; break;
                case "--user": Tracker.setUser(args[++k]); break;
                default: break;
            }
        }
        final String pid = profileId, out = shot, acts = actions;
        final int di = docIndex;
        SwingUtilities.invokeLater(() -> {
            App app = new App(pid);
            if (di > 0 && di < app.profile.docs.size()) { app.doc = app.profile.docs.get(di); app.refreshAll(); }
            app.frame.setVisible(true);
            app.page.requestFocusInWindow();
            if (out != null) {
                Timer t = new Timer(900, e -> {
                    if (acts != null) for (String a : acts.split(",")) app.use(a.trim());
                    Timer t2 = new Timer(700, x -> capture(app, out));
                    t2.setRepeats(false);
                    t2.start();
                });
                t.setRepeats(false);
                t.start();
            }
        });
    }

    private static void capture(App app, String out) {
        try {
            Rectangle r = app.frame.getBounds();
            BufferedImage img = new Robot().createScreenCapture(r);
            ImageIO.write(img, "png", new File(out));
            System.out.println("Snimljeno: " + out);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        System.exit(0);
    }
}
