import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ReadingPreferencesProvider } from '@/components/reading-preferences';

export const metadata: Metadata = {
  title: "OpenDraft — A little feedback. A better next draft.",
  description: "A free, open-source writing workshop. Exchange thoughtful critiques, find your writing circle, and make your next draft better.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="theme" disableTransitionOnChange>
          <ReadingPreferencesProvider>{children}</ReadingPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
