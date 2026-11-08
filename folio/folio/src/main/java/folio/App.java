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

/** Folio: a demo PDF tool with three profiles (developer, doctor, banker) who use it in completely different ways. */
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

    // ---------------- actions ----------------

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

    /** 1 page, 2 pages... */
    static String pagesLabel(int n) {
        return n + (n == 1 ? " page" : " pages");
    }

    /** The user clicked a tool: count it, send the event and update the document. */
    void use(String feature) {
        if (doc == null) return;
        Model.Doc d = doc;
        profile.bump(feature);
        Tracker.track("feature_used", profile, "feature", feature, "doc_kind", d.kind);
        String base = d.name.replace(".pdf", "");
        switch (feature) {
            case "search":
                toast("Search: 7 results in “" + base + "”");
                break;
            case "annotate":
                d.annotated = !d.annotated;
                toast(d.annotated ? "Comment added to page 1" : "Comment removed");
                break;
            case "sign":
                if (!d.has("signature")) toast("This document has no signature field");
                else if (d.signed) toast("This document is already signed");
                else { d.signed = true; toast("Document signed electronically"); }
                break;
            case "fill_form":
                if (!d.has("form")) toast("This document has no fields to fill in");
                else if (d.filled) toast("The form is already filled in");
                else { d.filled = true; toast("Form filled in: 6 fields"); }
                break;
            case "ocr":
                if (!d.scanned) toast("This document already has searchable text");
                else if (d.ocr) toast("Text has already been recognized");
                else { d.ocr = true; toast("Text recognized on " + pagesLabel(d.pages)); }
                break;
            case "redact":
                if (!d.hasSensitive()) toast("No personal data to redact in this document");
                else { d.redacted = !d.redacted; toast(d.redacted ? "Personal data redacted" : "Redaction removed"); }
                break;
            case "compare":
                if (d.changes.isEmpty()) toast("No previous version to compare with");
                else Dialogs.compare(this, d);
                break;
            case "merge":
                toast("Merged “" + base + "” and 2 more documents into Case file.pdf");
                break;
            case "compress":
                toast("Size reduced from " + d.size + " by 61%");
                break;
            case "export_text":
                toast("Exported to " + base + ".md");
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

    // ---------------- tool button ----------------

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
            boolean on = active();
            RoundRectangle2D bg = new RoundRectangle2D.Double(2, 2, w - 4, h - 4, 10, 10);
            if (getModel().isPressed()) { g2.setColor(Theme.GRID); g2.fill(bg); }
            else if (getModel().isRollover()) { g2.setColor(Theme.HOVER); g2.fill(bg); }
            g2.setColor(on ? Theme.TEXT : Theme.MUTED);
            Widgets.paintIcon(g2, f.icon, w / 2.0, 22, 18);
            if (attention()) {
                // Yellow dot with a black outline: the document is waiting for this tool.
                java.awt.geom.Ellipse2D dot = new java.awt.geom.Ellipse2D.Double(w / 2.0 + 9, 7, 9, 9);
                g2.setColor(Theme.MARKER);
                g2.fill(dot);
                g2.setColor(Theme.TEXT);
                Theme.stroke(g2, 1.3f);
                g2.draw(dot);
            }
            g2.setFont(on ? Theme.bold(11.5f) : Theme.font(11.5f));
            FontMetrics fm = g2.getFontMetrics();
            int tw = fm.stringWidth(f.name);
            // An applied tool is highlighted with the marker, like a word in a document.
            if (on) Theme.marker(g2, (w - tw) / 2.0 - 4, 38, tw + 8, 14);
            g2.setColor(Theme.TEXT);
            g2.drawString(f.name, (w - tw) / 2f, 49);
            g2.dispose();
        }
    }

    // ---------------- document header ----------------

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
            RoundRectangle2D kindChip = new RoundRectangle2D.Double(x, 14, kw, 22, 6, 6);
            g2.setColor(Theme.TEXT);
            Theme.stroke(g2, 1.2f);
            g2.draw(kindChip);
            g2.drawString(doc.kind, x + 10, 29);
            g2.setFont(Theme.bold(17f));
            g2.setColor(Theme.TEXT);
            fm = g2.getFontMetrics();
            g2.drawString(Theme.fit(doc.name, fm, w - kw - 260), x + kw + 12, 31);
            g2.setFont(Theme.font(12.5f));
            g2.setColor(Theme.MUTED);
            g2.drawString(pagesLabel(doc.pages) + " · " + doc.size + " · modified " + doc.updated, x, 54);

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

    // ---------------- top bar ----------------

    private class TopBar extends JPanel {
        final List<Widgets.Pill> profiles = new ArrayList<>();
        final JComponent logo;

        TopBar() {
            super(new BorderLayout());
            setBackground(Theme.CHROME);
            setBorder(new MatteBorder(0, 0, 1, 0, Theme.CHROME_LINE));
            setPreferredSize(new Dimension(1200, 72));

            JPanel left = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 16));
            left.setOpaque(false);
            left.setBorder(new EmptyBorder(0, 12, 0, 0));
            logo = new JComponent() {
                @Override protected void paintComponent(Graphics g) {
                    // Logo: the word "Folio" highlighted with the marker, black on yellow, on the black bar.
                    Graphics2D g2 = Theme.smooth(g);
                    g2.setFont(Theme.bold(23f));
                    FontMetrics fm = g2.getFontMetrics();
                    int tw = fm.stringWidth("Folio");
                    Theme.marker(g2, 4, 7, tw + 16, 30);
                    g2.setColor(Theme.TEXT);
                    g2.drawString("Folio", 12, 30);
                    g2.dispose();
                }
            };
            logo.setPreferredSize(new Dimension(140, 42));
            left.add(logo);
            left.add(Box.createHorizontalStrut(Sidebar.SIDE_W - 190));
            Widgets.Field search = new Widgets.Field("Search documents and text");
            search.setPreferredSize(new Dimension(380, 40));
            search.addActionListener(e -> use("search"));
            left.add(search);
            add(left, BorderLayout.WEST);

            JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 18));
            right.setOpaque(false);
            right.setBorder(new EmptyBorder(0, 0, 0, 18));
            for (String id : Model.PROFILE_IDS) {
                Model.Profile p = Model.load(id);
                Widgets.Pill pill = new Widgets.Pill(p.role, Widgets.Kind.CHROME);
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

    // ---------------- startup ----------------

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
                case "--profile": profileId = Model.profileId(args[++k]); break;
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
            System.out.println("Saved: " + out);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        System.exit(0);
    }
}
