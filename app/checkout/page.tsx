"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getIdToken } from "firebase/auth";

import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import { urlForImage } from "@/sanity/lib/image";

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export default function CheckoutPage() {
  const { cart, clearCart, getCartTotal } = useCart();
  const { user } = useAuth();
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  });

  // Handle Stripe redirect success or cancel query params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      clearCart();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled === "true") {
      alert("Payment was canceled. Please try again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [clearCart]);

  // Redirect if cart is empty
  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mt-8 py-16 border border-gray-200 dark:border-gray-800 rounded-lg">
          <h2 className="text-2xl font-medium mb-4">Your cart is empty</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            You need to add items to your cart before proceeding to checkout.
          </p>
          <Link
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-black px-6 py-3 rounded-lg inline-block transition hover:opacity-90"
            href="/cart"
          >
            Return to Cart
          </Link>
        </div>
      </div>
    );
  }

  const handleStripeReady = (stripeInstance: any, elementsInstance: any) => {
    setStripe(stripeInstance);
    setElements(elementsInstance);
  };

  const handleShippingChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handlePayment = async () => {
    if (!stripe || !elements) {
      alert("Stripe is not ready yet. Please wait and try again.");

      return;
    }

    // Validate shipping information
    if (
      !shippingInfo.firstName ||
      !shippingInfo.lastName ||
      !shippingInfo.email ||
      !shippingInfo.phone ||
      !shippingInfo.address ||
      !shippingInfo.city ||
      !shippingInfo.state ||
      !shippingInfo.zipCode
    ) {
      alert("Please fill in all shipping information fields.");

      return;
    }

    setIsProcessing(true);

    try {
      // Get user token if authenticated
      let userToken = null;
      let userId = null;

      if (user) {
        try {
          userToken = await getIdToken(user);
          userId = user.uid;
        } catch (error) {
          console.warn("Could not get user token:", error);
        }
      }

      // Create payment intent with proper data structure
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            id: item.product._id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
          })),
          shipping: {
            cost: 0,
          },
          metadata: {
            customer_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
            customer_email: shippingInfo.email,
            customer_phone: shippingInfo.phone,
            shipping_address: `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.state}, ${shippingInfo.zipCode}, ${shippingInfo.country}`,
            user_id: userId || "",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create payment intent: ${response.statusText}`,
        );
      }

      const { clientSecret } = await response.json();

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement("card"),
          },
        },
      );

      if (error) {
        alert(`Payment failed: ${error.message}`);
      } else if (paymentIntent?.status === "succeeded") {
        alert("Payment successful! Your order has been processed.");
        clearCart();

        // Redirect to orders page if user is authenticated
        if (user) {
          window.location.href = "/account/orders";
        }
      }
    } catch (error) {
      alert("An error occurred during payment processing.");
      console.error("Payment error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const total = getCartTotal();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shipping and Payment Forms */}
          <div className="space-y-8">
            {/* Shipping Information */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Shipping Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    htmlFor="firstName"
                  >
                    First Name
                  </label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    id="firstName"
                    type="text"
                    value={shippingInfo.firstName}
                    onChange={(e) =>
                      handleShippingChange("firstName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    htmlFor="lastName"
                  >
                    Last Name
                  </label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    id="lastName"
                    type="text"
                    value={shippingInfo.lastName}
                    onChange={(e) =>
                      handleShippingChange("lastName", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  id="email"
                  type="email"
                  value={shippingInfo.email}
                  onChange={(e) =>
                    handleShippingChange("email", e.target.value)
                  }
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  htmlFor="phone"
                >
                  Phone
                </label>
                <input
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  id="phone"
                  type="tel"
                  value={shippingInfo.phone}
                  onChange={(e) =>
                    handleShippingChange("phone", e.target.value)
                  }
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  htmlFor="address"
                >
                  Address
                </label>
                <input
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  id="address"
                  type="text"
                  value={shippingInfo.address}
                  onChange={(e) =>
                    handleShippingChange("address", e.target.value)
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    htmlFor="city"
                  >
                    City
                  </label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    id="city"
                    type="text"
                    value={shippingInfo.city}
                    onChange={(e) =>
                      handleShippingChange("city", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    htmlFor="state"
                  >
                    State
                  </label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    id="state"
                    type="text"
                    value={shippingInfo.state}
                    onChange={(e) =>
                      handleShippingChange("state", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    htmlFor="zipCode"
                  >
                    ZIP Code
                  </label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    id="zipCode"
                    type="text"
                    value={shippingInfo.zipCode}
                    onChange={(e) =>
                      handleShippingChange("zipCode", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  htmlFor="country"
                >
                  Country
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  id="country"
                  value={shippingInfo.country}
                  onChange={(e) =>
                    handleShippingChange("country", e.target.value)
                  }
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                </select>
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Payment Information</h2>

              <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
                <StripePaymentForm onReady={handleStripeReady} />

                <button
                  className="w-full mt-6 bg-gray-900 dark:bg-gray-100 text-white dark:text-black px-6 py-3 rounded-lg font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!stripe || !elements || isProcessing}
                  onClick={handlePayment}
                >
                  {isProcessing ? "Processing..." : `Pay $${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Order Summary</h2>

            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.product._id}
                  className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg"
                >
                  {item.product.mainImage && (
                    <div className="w-16 h-16 relative flex-shrink-0">
                      <Image
                        fill
                        alt={item.product.name}
                        className="object-cover rounded-md"
                        src={urlForImage(item.product.mainImage)
                          .width(64)
                          .height(64)
                          .url()}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium">{item.product.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Quantity: {item.quantity}
                    </p>
                    <p className="font-medium">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
