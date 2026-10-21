import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Video Studio - Professional AI Video Editor",
  description:
    "Professional in-browser video editor with multi-track timeline, Gemini-powered natural language editing assistant, speech captions, and FFmpeg media processing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className={`${inter.variable} font-sans bg-zinc-950 text-zinc-100 min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
