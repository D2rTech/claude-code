import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "TrendPulse — Ecommerce competitor, trend & ad intelligence", template: "%s · TrendPulse" },
  description: "Spot winning products, track competitor stores and decode their ads — know what works in ecommerce, how and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
