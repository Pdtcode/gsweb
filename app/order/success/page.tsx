import type { Metadata } from "next";

import { Suspense } from "react";
import OrderSuccessClient from "./OrderSuccessClient";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <OrderSuccessClient />
    </Suspense>
  );
}
