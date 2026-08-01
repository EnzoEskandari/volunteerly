import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Volunteerly — Volunteer Better",
    template: "%s · Volunteerly",
  },
  description:
    "Find meaningful volunteer opportunities, build your impact, and receive trusted digital records of your community service.",
  metadataBase: new URL("https://volunteerly.app"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F172A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
