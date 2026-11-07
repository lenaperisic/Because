import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Folio · AI intervjui", description: "PostHog događaji → činjenice → AI intervju" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
