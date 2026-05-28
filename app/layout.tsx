import type { Metadata } from "next";
import "./globals.css";
import { GoogleProvider } from './providers/GoogleProvider';
import { Playfair_Display } from "next/font/google";
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "PortfoliAI",
  description: "PortfoliAI is a personal finance management tool that helps you track and analyze your investments. With PortfoliAI, you can easily import your transaction data, visualize your portfolio performance, and make informed decisions to optimize your financial future.",
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <GoogleProvider>
          {children}
        </GoogleProvider>
      </body>
    </html>
  );
}