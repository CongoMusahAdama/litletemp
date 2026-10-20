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
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF4081",
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="mask-icon" href="/app-icon-512.png" color="#FF4081" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Little Temptation" />
        <meta name="theme-color" content="#FF4081" />
        <meta name="msapplication-TileColor" content="#FF4081" />
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
