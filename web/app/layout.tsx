import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import Sidebar from "@/components/Sidebar";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vyuha — BTP Parking Intelligence",
  description:
    "Vyuha helps Bengaluru Traffic Police optimize patrol routes and identify enforcement-resistant zones that need infrastructure fixes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased">
        <Sidebar />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}

