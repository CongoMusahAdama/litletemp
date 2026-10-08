import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { NamesProvider } from "@/context/NamesContext";
import { SessionProvider } from "@/context/SessionContext";

export const metadata: Metadata = {
  title: "Little Temptation — Just You. Just Me. Just Us.",
  description: "A private, intimate space for just the two of us. Share moments, leave love notes, and stay connected.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Little Temptation",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBBF24",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icon.png" sizes="512x512" />
        <link rel="mask-icon" href="/icon.png" color="#FBBF24" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Little Temptation" />
        <meta name="theme-color" content="#FBBF24" />
        <meta name="msapplication-TileColor" content="#FBBF24" />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <NamesProvider>{children}</NamesProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
