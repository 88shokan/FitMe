import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";

/**
 * Denim design system typefaces:
 *   Barlow Condensed — display, the compressed workwear stencil look
 *   Barlow           — headings and labels, industrial but readable
 *   Source Sans 3    — body copy
 */
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FitMe — see it on you before you order",
  description:
    "Cut apparel returns by showing shoppers how clothes actually look and fit on them, before they buy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${barlow.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
