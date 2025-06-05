'use client'
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Link } from "@heroui/link";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";
import { useState } from "react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import ThemeLogo from "@/components/theme-logo";
import { CartButton } from "@/components/cart-button";
import { LoginButton } from "@/components/login-button";
import { useAuth } from "@/context/AuthContext";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logOut } = useAuth();

  const handleLogout = async () => {
    try {
      await logOut();
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <HeroUINavbar 
      maxWidth="xl" 
      position="sticky"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <ThemeLogo />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
          <CartButton />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
          <LoginButton />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <CartButton />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link 
                color={"foreground"} 
                href={item.href} 
                size="lg"
                onPress={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
          
          {/* Authentication Menu Items */}
          <div className="border-t border-default-200 pt-2 mt-2">
            {user ? (
              // If user is logged in, show account options and logout
              <>
                <NavbarMenuItem>
                  <Link 
                    color={"foreground"} 
                    href="/account" 
                    size="lg"
                    onPress={() => setIsMenuOpen(false)}
                  >
                    My Account
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem>
                  <Link 
                    color={"foreground"} 
                    href="/account/orders" 
                    size="lg"
                    onPress={() => setIsMenuOpen(false)}
                  >
                    My Orders
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem>
                  <button
                    className="w-full text-left text-lg text-danger hover:text-danger-500"
                    onClick={handleLogout}
                  >
                    Log Out
                  </button>
                </NavbarMenuItem>
              </>
            ) : (
              // If user is not logged in, show login option
              <NavbarMenuItem>
                <Link 
                  color={"primary"} 
                  href="/login" 
                  size="lg"
                  onPress={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
              </NavbarMenuItem>
            )}
          </div>
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
