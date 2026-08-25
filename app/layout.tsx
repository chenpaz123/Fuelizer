import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import Script from "next/script";
import { BottomNav } from "@/components/nav/bottom-nav";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "Fuelizer",
  description: "מעקב תדלוקים, טלמטריה וחיוב עבור הקיה פיקנטו שלכם",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fuelizer",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) resolve on notched iPhones instead of 0 —
  // components/nav/bottom-nav.tsx's safe-area padding depends on this.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3c83f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below adds the `dark`
    // class to this element (or not) before React hydrates, based on
    // localStorage — a real, expected mismatch against the server-rendered
    // markup, not a bug. It only suppresses the warning for this element's
    // attributes.
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <body className="font-sans">
        {/*
          Sets the `dark` class on <html> before hydration so there's no
          flash of the wrong theme on load. Must use next/script's
          `beforeInteractive` strategy (not a plain <script> tag) to run
          early enough — see that strategy's docs for why.
        */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-6">{children}</main>
        <BottomNav />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
