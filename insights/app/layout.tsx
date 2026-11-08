import type { ReactNode } from "react";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Grotesk napravljen za novinsku kuću: priča iz podataka, ne „editorial“ serif. Varijabilan 400–900.
const sans = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-schibsted" });

export const metadata = { title: "Folio · AI intervjui", description: "PostHog događaji → činjenice → AI intervju" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
