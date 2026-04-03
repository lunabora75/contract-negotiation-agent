import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MResult — Contract Negotiation",
  description: "AI-powered SOW contract negotiation agent by MResult",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* MResult official brand fonts — Raleway (headings) + Montserrat (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&family=Montserrat:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
