"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import clsx from "clsx";

import { UserAccountButton } from "./user-account-button";

import { useAuth } from "@/context/AuthContext";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";

// Cream pill styling for the maroon homepage navbar (legible in both themes).
const homeBtn = "!bg-[#f3ede1]/15 !text-[#f3ede1] hover:!bg-[#f3ede1]/25";
const defaultBtn = "text-default-600 bg-default-100";

export const LoginButton = () => {
  const { user } = useAuth();
  const isHome = usePathname() === "/" && NEW_ARRIVALS_HOME_ACTIVE;
  const [mounted, setMounted] = useState(false);

  // Hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same size to avoid layout shift
    return (
      <Button
        className={clsx("text-sm font-normal", isHome ? homeBtn : defaultBtn)}
        variant="flat"
      >
        Login
      </Button>
    );
  }

  // If user is logged in, show the user account button
  if (user) {
    return <UserAccountButton />;
  }

  // Otherwise, show the login button
  return (
    <Button
      as={Link}
      className={clsx("text-sm font-normal", isHome ? homeBtn : defaultBtn)}
      href="/login"
      variant="flat"
    >
      Login
    </Button>
  );
};
