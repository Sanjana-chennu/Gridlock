import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import Sidebar from "@/components/Sidebar";

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
    <html lang="en">
      <body>
        <Sidebar />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
