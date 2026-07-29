import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import FeedbackWidget from "@/components/ui/FeedbackWidget";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without an explicit minimumScale, mobile browsers clamp pinch-zoom-out at
  // the initial scale for a document that has no overflow to reveal — so the
  // wide Budget/Compare tables can't be zoomed out to fit. maximumScale and
  // userScalable stay permissive so zooming *in* still works for accessibility.
  minimumScale: 0.25,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "Wedding Planner",
  description: "Your personal wedding planning app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
