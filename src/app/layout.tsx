import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quill AI — Your Personal AI Agent",
  description:
    "Quill AI is your killer personal assistant AI agent. Plan, research, write, and execute complex tasks autonomously.",
  keywords: ["AI agent", "personal assistant", "Quill AI", "autonomous AI"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
