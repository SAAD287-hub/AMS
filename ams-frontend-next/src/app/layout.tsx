import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@openuidev/react-ui/components.css";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { TopLoader } from "@/components/TopLoader";

export const metadata: Metadata = {
  title: {
    default: "NEDUET AMS",
    template: "%s · NEDUET AMS",
  },
  description: "NEDUET Asset Management System: track inventory, locations, employees, maintenance, and depreciation across the university.",
  applicationName: "NEDUET AMS",
  keywords: ["NEDUET", "AMS", "Asset Management", "Inventory", "NED University"],
  authors: [{ name: "NED University of Engineering & Technology" }],
  creator: "NED University of Engineering & Technology",
  publisher: "NED University of Engineering & Technology",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  icons: {
    icon: "/ned_seal.webp",
    apple: "/ned_seal.webp",
    shortcut: "/ned_seal.webp",
  },
  openGraph: {
    title: "NEDUET AMS",
    description: "Asset Management System for NED University of Engineering & Technology.",
    siteName: "NEDUET AMS",
    type: "website",
    locale: "en_PK",
    images: [{ url: "/ned_seal.webp", width: 512, height: 512, alt: "NED University" }],
  },
  twitter: {
    card: "summary",
    title: "NEDUET AMS",
    description: "Asset Management System for NED University of Engineering & Technology.",
    images: ["/ned_seal.webp"],
  },
  formatDetection: { email: false, address: false, telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7c3aed" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0A1A" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Apply theme before paint to avoid flash-of-wrong-theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ams.theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Suspense fallback={null}><TopLoader /></Suspense>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
