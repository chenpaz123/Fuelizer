import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { BottomNav } from "@/components/nav/bottom-nav";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "Fuelizer",
  description: "מעקב תדלוקים, טלמטריה וחיוב עבור הקיה פיקנטו שלכם",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans">
        <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-6">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
