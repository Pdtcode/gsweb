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
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";

import { siteConfig } from "@/config/site";
import { fontDokdo } from "@/config/fonts";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";
import { ThemeSwitch } from "@/components/theme-switch";
import ThemeLogo from "@/components/theme-logo";
import { CartButton } from "@/components/cart-button";
import { LoginButton } from "@/components/login-button";
import { useAuth } from "@/context/AuthContext";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logOut } = useAuth();

  // Maroon navbar (matching the Life Sucks artwork) — only on the homepage
  // AND only while the new-arrivals homepage is active (config/homepage.ts).
  const isMaroonHome = usePathname() === "/" && NEW_ARRIVALS_HOME_ACTIVE;
  // Cream text/icons so the nav stays legible on the maroon background
  // (in both light and dark themes).
  const homeText = isMaroonHome ? "!text-[#f3ede1]" : "";

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
      classNames={
        isMaroonHome
          ? {
              base: clsx(
                "!bg-[#621600] !backdrop-blur-none !overflow-visible",
                // Drop the drips while the mobile menu is open so they don't
                // overlap the dropdown; they return when it closes.
                !isMenuOpen && "navbar-drip",
                fontDokdo.className,
              ),
            }
          : undefined
      }
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <ThemeLogo />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-8 justify-start ml-4">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                  homeText,
                  isMaroonHome && "!text-3xl",
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
          <ThemeSwitch
            classNames={
              isMaroonHome ? { wrapper: "!text-[#f3ede1]" } : undefined
            }
          />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
          <CartButton />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
          <LoginButton />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch
          classNames={
            isMaroonHome ? { wrapper: "!text-[#f3ede1]" } : undefined
          }
        />
        <CartButton />
        <NavbarMenuToggle className={homeText} />
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
