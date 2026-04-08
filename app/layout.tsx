import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import FeedbackWidget from "@/components/ui/FeedbackWidget";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
