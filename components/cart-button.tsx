"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import clsx from "clsx";

import { useCart } from "@/context/CartContext";
import { CartIcon } from "@/components/icons";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";

// Cream pill styling for the maroon homepage navbar (legible in both themes).
const homeBtn =
  "!bg-[#f3ede1]/15 !text-[#f3ede1] hover:!bg-[#f3ede1]/25";
const defaultBtn = "text-default-600 bg-default-100";

export const CartButton = () => {
  const { getCartItemsCount, cart } = useCart();
  const isHome = usePathname() === "/" && NEW_ARRIVALS_HOME_ACTIVE;
  const [mounted, setMounted] = useState(false);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    setItemCount(getCartItemsCount());
  }, []);

  // Monitor cart changes
  useEffect(() => {
    if (mounted) {
      setItemCount(getCartItemsCount());
    }
  }, [getCartItemsCount, mounted, cart]);

  return (
    <Button
      as={Link}
      className={clsx(
        "text-sm font-normal relative",
        isHome ? homeBtn : defaultBtn,
      )}
      href="/cart"
      variant="flat"
    >
      <CartIcon size={20} />
      {mounted && itemCount > 0 && (
        <span className=" ml-1 bg-red-500 text-white text-xs rounded-full min-h-5 min-w-5 px-1.5 flex items-center justify-center">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Button>
  );
};
