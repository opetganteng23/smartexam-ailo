import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ResponsiveTables } from "@/components/ResponsiveTables";
import { FeedbackHost } from "@/components/Feedback";
import { BrandBg } from "@/components/BrandBg";
import { BusyBar } from "@/components/BusyBar";
import { Suspense } from "react";
import { LangProvider } from "@/components/LangProvider";
import { getLang } from "@/lib/i18n-server";

// Poppins di-host sendiri (file di app/fonts, lisensi OFL): satu-satunya font aplikasi, termasuk judul.
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins", display: "swap",
});

export const metadata: Metadata = {
  title: "Smartexam by AILO | Online exams, analysis, and learning",
  description: "Smartexam by AILO: online tests, AI analysis, and an AI Counselor.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A4256" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang}>
      <body className={`${poppins.variable}`}><LangProvider initial={lang}>{children}</LangProvider><ResponsiveTables /><FeedbackHost /><BrandBg /><Suspense fallback={null}><BusyBar /></Suspense></body>
    </html>
  );
}
