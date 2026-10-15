import type { Metadata } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: "800",
  style: "italic",
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Active Mentor — Physiologist Portal",
  description: "Physiologist dashboard for Active Mentor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${archivo.variable} ${jakarta.className} h-full antialiased`}>
      <body className="min-h-full bg-[#1c1c1f] text-white flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
