"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useStoreUserEffect } from "@/hooks/use-store-user";
import { BarLoader} from "react-spinners";
import { usePathname } from "next/navigation";

const Header = () => {
  const { isLoading } = useStoreUserEffect();
  const path = usePathname();

  return (
    <header className="fixed top-0 w-full border-b bg-white/95 backdrop-blur z-50 supports-[backdrop-filter]:bg-white/60">
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={"/logos/FairShare-logo.png"}
            alt="FairShare Logo"
            width={800}
            height={240}
            className="h-11 w-auto object-contain"
          />
        </Link>

        {path==='/' && (
          <div className="hideen md:flex items-center gap-6">
            <Link href="#fetures" className="text-sm font-medium hover:text-green-600 transition">
            Features
            </Link>
            <Link href="#fetures" className="text-sm font-medium hover:text-green-600 transition">
            How It Works
            </Link>
          </div>
        )}
      </nav>

      {isLoading && <BarLoader width={"100%"} color="#36d7b7" />}
    </header>
  );
};

export default Header;