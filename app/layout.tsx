import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fuelizer",
  description: "Fuel tracking, telemetry analysis, and billing for the Kia Picanto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-border">
          <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
            <span className="font-semibold">Fuelizer</span>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/lab" className="text-sm text-muted-foreground hover:text-foreground">
              Lab
            </Link>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
