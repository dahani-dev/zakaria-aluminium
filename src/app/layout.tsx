import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import "./globals.css";
import { ToastContainer } from "react-toastify";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased bg-gray-800 text-white`}>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
