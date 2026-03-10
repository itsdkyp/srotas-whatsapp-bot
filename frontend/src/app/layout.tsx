import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DemoBanner } from "@/components/layout/demo-banner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Srotas.bot",
  description: "WhatsApp Bot Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
          try {
            if (localStorage.getItem('theme') === 'light') {
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.add('dark');
            }
          } catch (e) {}
        `}} />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased flex flex-col h-screen overflow-hidden`}>
        <DemoBanner />
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
