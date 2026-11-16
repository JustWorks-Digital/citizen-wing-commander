import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Exo_2, JetBrains_Mono } from "next/font/google";
import { SessionRecorderHost } from "@/components/dev/SessionRecorderHost";
import { PerfCaptureProvider } from "@/components/perf/PerfCaptureProvider";
import "./globals.css";

function isSessionRecorderEnabled(): boolean {
  const flag = process.env.SESSION_RECORDER_ENABLED?.trim();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return process.env.NODE_ENV === "development";
}

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Citizen Wing Commander",
  description: "Star Citizen companion app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b121c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${exo.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-rsi-text">
        {process.env.NODE_ENV === "development" ? (
          <PerfCaptureProvider>{children}</PerfCaptureProvider>
        ) : (
          children
        )}
        <Suspense fallback={null}>
          <SessionRecorderHost enabled={isSessionRecorderEnabled()} />
        </Suspense>
      </body>
    </html>
  );
}
