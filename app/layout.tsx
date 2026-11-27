import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { ORG_NAME } from "@/lib/brand";

const kr = Noto_Sans_KR({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-kr", display: "swap" });

export const metadata: Metadata = {
  title: ORG_NAME,
  description: "사단장 전용 비서처 — AI 에이전트 지휘·보고",
  applicationName: ORG_NAME,
  appleWebApp: { capable: true, title: ORG_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6eee2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${kr.variable} font-sans font-bold antialiased`}>{children}</body>
    </html>
  );
}
