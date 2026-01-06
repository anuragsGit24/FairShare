"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useStoreUserEffect } from "@/hooks/use-store-user";
import { BarLoader} from "react-spinners";

const Header = () => {
  const { isLoading } = useStoreUserEffect();

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



      </nav>

      {isLoading && <BarLoader width={"100%"} color="#36d7b7" />}
    </header>
  );
};

export default Header;