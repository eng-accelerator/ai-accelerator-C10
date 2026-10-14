import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/AppShell/TopNav";
import { Footer } from "@/components/AppShell/Footer";
import { WorkspaceProvider } from "@/lib/WorkspaceContext";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Orion // Build an AI Coding Agent",
  description:
    "Learn to build AI coding agents from scratch — from tool use to self-correction to production multi-agent systems. Interactive demos for every concept.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-night text-ink font-body min-h-screen">
        <WorkspaceProvider>
          <TopNav />
          <main className="pt-16 min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </main>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
