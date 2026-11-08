import type { ReactNode } from "react";
import Link from "next/link";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Grotesk napravljen za novinsku kuću: priča iz podataka, ne „editorial“ serif. Varijabilan 400–900.
const sans = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-schibsted" });

export const metadata = {
  title: "Because · zašto korisnici rade to što rade",
  description: "PostHog vam kaže šta korisnici rade. Because ih pita zašto, i to svakog o onome što je on uradio.",
};

/** Znak: matematički simbol ∵ („zato što“), tri tačke u obrnutom trouglu, bojom glasa korisnika. */
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
    <html lang="sr" className={sans.variable}>
      <body>
        <header className="brandbar">
          <Link href="/" className="brand" aria-label="Because, početna">
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
