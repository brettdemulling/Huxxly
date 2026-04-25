import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Huxxly",
  description: "Intelligent grocery planning, effortlessly done.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] min-h-screen font-sans">
        <main className="max-w-[480px] mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
