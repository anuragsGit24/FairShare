"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useStoreUserEffect } from "@/hooks/use-store-user";
import { BarLoader} from "react-spinners";
import { usePathname } from "next/navigation";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "./ui/button";
import { LayoutDashboard } from "lucide-react";
import ThemeToggle from "./theme-toggle";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Header = () => {
  const { isLoading } = useStoreUserEffect();
  const path = usePathname();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkTheme = mounted && theme === "dark";

  return (
    <header className="fixed top-0 w-full border-b bg-background/95 backdrop-blur z-50 supports-[backdrop-filter]:bg-background/80">
      <nav className="container mx-auto px-4 h-16 flex items-center relative">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {isDarkTheme ? (
            <span className="text-green-500 font-extrabold text-2xl sm:text-3xl leading-none tracking-tight">
              FairShare
            </span>
          ) : (
            <Image
              src="/logos/FairShare-logo.png"
              alt="FairShare Logo"
              width={1600}
              height={480}
              className="h-14 sm:h-14 w-auto object-contain"
            />
          )}
        </Link>

        {path==='/' && (
          <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
            <Link href="#features" className="text-sm font-medium hover:text-green-600 transition">
            Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium hover:text-green-600 transition">
            How It Works
            </Link>
          </div>
        )}
        
        <div className="flex items-center gap-4 ml-auto">
          <ThemeToggle />

          <Authenticated>
            <Link href="/dashboard">
              <Button variant="outline"
              className="hidden md:inline-flex items-center gap-2 hover:text-green-600 hover:border-green-600 transition">
                <LayoutDashboard className="h-4 w-4" />
                DashBoard
              </Button>

              <Button variant="ghost" className="md:hidden w-10 h-10 p-0">
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            </Link>

            <UserButton />
          </Authenticated>

          <Unauthenticated>
            <SignInButton>
              <Button variant="ghost">Sign In</Button>
            </SignInButton>

            <SignUpButton>
              <Button className="bg-green-600 hover:bg-green-700 border-none">
                Get Started
              </Button>
            </SignUpButton>
          </Unauthenticated>
        </div>
      </nav>

      {isLoading && <BarLoader width={"100%"} color="#36d7b7" />}
    </header>
  );
};

export default Header;