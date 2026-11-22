import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Travel Bag — Dashboard",
  description: "Real-Time IoT Monitoring & AI-Assisted Security",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
