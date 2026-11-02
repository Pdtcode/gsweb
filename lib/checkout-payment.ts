import { getIdToken, type User } from "firebase/auth";

import type { CartItem } from "@/context/CartContext";
import type { CustomerDetails } from "@/lib/express-checkout-details";

interface PaymentRequest {
  items: CartItem[];
  details: CustomerDetails;
  deliveryMethod: string;
  expectedTotal: number;
  user?: User | null;
  discountCode?: string;
}

// Asks the server to create the order and payment, for every way of paying.
export async function requestPayment({
  items,
  details,
  deliveryMethod,
  expectedTotal,
  user,
  discountCode,
}: PaymentRequest) {
  let userToken: string | null = null;
  let userId: string | null = null;

  if (user) {
    try {
      userToken = await getIdToken(user);
      userId = user.uid;
    } catch (error) {
      console.warn("Could not get user token:", error);
    }
  }

  const response = await fetch("/api/create-payment-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userToken && { Authorization: `Bearer ${userToken}` }),
    },
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.product._id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        variantId: item.selectedVariant?.sku || null,
        variantSize: item.selectedVariant?.size || null,
        variantColor: item.selectedVariant?.color || null,
        // Bundle lines carry their component choices. The server re-reads
        // the bundle from Sanity and expands it into one OrderItem per
        // component, so stock is deducted per product as normal.
        bundle: item.bundle
          ? {
              bundleId: item.bundle.bundleId,
              slug: item.bundle.slug,
              selections: item.bundle.selections.map((sel) => ({
                productId: sel.productId,
                productSlug: sel.productSlug,
                quantity: sel.quantity,
                sku: sel.sku,
                size: sel.size ?? null,
                color: sel.color ?? null,
              })),
            }
          : undefined,
      })),
      shipping: {
        cost: 0,
      },
      // The server prices everything itself — item prices, the promo
      // discount and the service fee. It only needs the code, plus the
      // total shown here so it can refuse to charge a different one.
      discount: discountCode ? { code: discountCode } : undefined,
      expectedTotal,
      deliveryMethod,
      shippingApartment:
        deliveryMethod === "shipping" && details.address?.apartment
          ? details.address.apartment
          : undefined,
      metadata: {
        customer_name: details.name,
        customer_email: details.email,
        customer_phone: details.phone,
        shipping_address:
          deliveryMethod === "shipping" && details.address
            ? `${details.address.line1}, ${details.address.city}, ${details.address.state}, ${details.address.postalCode}, ${details.address.country}`
            : "",
        user_id: userId || "",
        promo_code: discountCode || "",
      },
    }),
  });

  return { response, result: await response.json().catch(() => null) };
}
