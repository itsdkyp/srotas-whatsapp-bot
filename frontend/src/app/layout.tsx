import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-center py-1.5 px-4 text-[11px] font-medium tracking-wide flex-shrink-0 z-50 relative shadow-md w-full">
          This is a functional mock showcase. UI states are simulated and will not affect real data.
        </div>
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
