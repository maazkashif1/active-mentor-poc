import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Active Mentor — Physiologist Portal",
  description: "Physiologist dashboard for Active Mentor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#1c1c1f] text-white flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
