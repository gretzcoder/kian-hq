import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UIProvider } from "@/components/ui/UIProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KIAN HQ — AI Powered Creative Team Operating System",
  description: "KIAN HQ is an AI-powered creative team operating system built for modern creative agencies. Manage projects, tasks, timelines, briefs, and team collaboration in one unified platform.",
  icons: {
    icon: [
      { url: '/favicon.ico?v=5', type: 'image/x-icon' },
      { url: '/kian.ico?v=5', type: 'image/x-icon' },
      { url: '/icon.svg?v=5', type: 'image/svg+xml' },
      { url: '/icon-192.png?v=5', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png?v=5', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico?v=5',
    apple: [
      { url: '/apple-touch-icon.png?v=5', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: "/manifest.json?v=5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KIAN HQ",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#030303" },
    { media: "(prefers-color-scheme: dark)", color: "#030303" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.ico?v=5" type="image/x-icon" sizes="any" />
        <link rel="icon" href="/icon.svg?v=5" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.ico?v=5" type="image/x-icon" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=5" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `
          }}
        />
      </head>
      <body
        suppressHydrationWarning={true}
        className="min-h-full flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors duration-200"
      >
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
