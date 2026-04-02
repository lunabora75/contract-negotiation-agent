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
        {/* MResult brand fonts — Mukta Vaani, Josefin Sans, Biryani */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mukta+Vaani:wght@400;600;700&family=Josefin+Sans:ital,wght@0,300;0,400;0,600;1,300&family=Biryani:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
