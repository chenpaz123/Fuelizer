import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { BottomNav } from "@/components/nav/bottom-nav";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
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
  themeColor: "#3c83f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans">
        <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-6">{children}</main>
        <BottomNav />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
