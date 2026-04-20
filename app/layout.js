import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import {Inter} from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FairShare",
  description: "The smartest way to Split expenses fairly with anyone",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
    <head>
      <link rel="icon" href="logos/logo-f.png" sizes="any" />
    </head>
      
      <body className={`${inter.className}`}>
      <ClerkProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ConvexClientProvider>
            <Header/>
            <main className="min-h-screen">
              {children}
              <Toaster richColors />
            </main>
          </ConvexClientProvider>
        </ThemeProvider>
      </ClerkProvider>
      <Analytics />
      </body>

    </html>
  );
}
