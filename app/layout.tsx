import type { Metadata } from "next";
import "./globals.css";
import { GoogleProvider } from './providers/GoogleProvider';
import { Playfair_Display } from "next/font/google";
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_DESCRIPTION = "PortfoliAI is a personal finance management tool that helps you track and analyze your investments. With PortfoliAI, you can easily import your transaction data, visualize your portfolio performance, and make informed decisions to optimize your financial future.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PortfoliAI",
    template: "%s | PortfoliAI",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "PortfoliAI",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "PortfoliAI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PortfoliAI",
    description: SITE_DESCRIPTION,
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GoogleProvider>
          {children}
        </GoogleProvider>
      </body>
    </html>
  );
}