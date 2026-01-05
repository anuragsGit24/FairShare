import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import {Inter} from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FairShare",
  description: "The smartest way to Split expenses fairly with anyone",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
    <head>
      <link rel="icon" href="logos/logo-f.png" sizes="any" />
    </head>
      
      <body className={`${inter.className}`}>
      <ClerkProvider>
        <ConvexClientProvider>
        <Header/>
        <main className="min-h-screen">{children}</main>
      </ConvexClientProvider>
      </ClerkProvider>
      </body>

    </html>
  );
}
