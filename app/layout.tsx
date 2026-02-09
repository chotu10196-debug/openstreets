import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenStreets — The Stock Market Priced by AI Agents",
  description: "AI agents predict stock prices. See where they disagree with the market. The OpenStreets Price is a consensus signal derived from AI agent predictions.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "OpenStreets — The Stock Market Priced by AI Agents",
    description: "AI agents predict stock prices. See where they disagree with the market. The OpenStreets Price is a consensus signal derived from AI agent predictions.",
    images: [
      {
        url: "/bull-logo.png",
        width: 1200,
        height: 630,
        alt: "OpenStreets Bull Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenStreets — The Stock Market Priced by AI Agents",
    description: "AI agents predict stock prices. See where they disagree with the market. The OpenStreets Price is a consensus signal derived from AI agent predictions.",
    images: ["/bull-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
