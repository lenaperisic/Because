import type { ReactNode } from "react";
import Link from "next/link";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// A grotesk made for a news publisher: a story told with data, not an "editorial" serif. Variable 400–900.
const sans = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-schibsted" });

export const metadata = {
  title: "Because · why users do what they do",
  description: "PostHog tells you what users do. Because asks them why, each one about what they actually did.",
};

/** Mark: the math symbol ∵ ("because"), three dots in an inverted triangle, in the color of the user's voice. */
function BecauseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="brand-mark">
      <circle cx="5.5" cy="7" r="3.1" />
      <circle cx="18.5" cy="7" r="3.1" />
      <circle cx="12" cy="18" r="3.1" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <header className="brandbar">
          <Link href="/" className="brand" aria-label="Because, home">
            <BecauseMark />
            <span className="wordmark">because</span>
          </Link>
          <span className="brandbar-meta">Folio · PostHog</span>
        </header>
        {children}
      </body>
    </html>
  );
}
