import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/standard.css"; // self-hosted Inter (offline-safe builds)
import { env } from "@/lib/env";
import { Header } from "@/components/navigation/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ustoz.uz"),
  title: {
    default: `${env.appName} — onlayn va offlayn kurslar marketplace`,
    template: `%s · ${env.appName}`,
  },
  description:
    "Sizga mos ustozni toping: onlayn va offlayn kurslar, tajribali ustozlar, " +
    "shahringiz bo‘ylab — barchasi USTOZ’da.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    /*
     * `data-scroll-behavior="smooth"` is required by Next 16 whenever the
     * stylesheet turns on `scroll-behavior: smooth` (globals.css does, inside a
     * `prefers-reduced-motion: no-preference` query): without the attribute the
     * router cannot tell that a route change should jump instantly, and it warns
     * at runtime. The attribute is a declaration, not a style — the media query
     * in CSS stays the single source of truth for WHEN scrolling is smooth.
     */
    <html lang="uz" className="h-full" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-base focus:font-medium focus:shadow-raised"
        >
          Kontentga o‘tish
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
