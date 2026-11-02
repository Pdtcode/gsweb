"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import CircularTextSpinner from "@/components/circular-text-spinner";
import { ExpressCheckout } from "@/components/express-checkout";
import type { CustomerDetails } from "@/lib/express-checkout-details";
import { requestPayment } from "@/lib/checkout-payment";
import {
  addressErrors,
  cleanText,
  emailError,
  emailTypoSuggestion,
  nameError,
  normalizeEmail,
  normalizePhone,
  normalizePostalCode,
  normalizeRegion,
  phoneError,
  regionsFor,
} from "@/lib/checkout-validation";
import { PromoCode, DiscountInfo } from "@/components/promo-code";
import { urlForImage } from "@/sanity/lib/image";
import { productImageUrl, productPhotoForColor } from "@/lib/product-image";
import { calculateServiceFee, formatServiceFeeDisplay, getServiceFeePercentage } from "@/lib/service-fee";
import { getSpendDiscount, type SpendCampaign } from "@/lib/spend-campaign";
import { DeliveryMethodToggle } from "@/components/delivery-method-toggle";
import type { DeliveryMethod } from "@/components/delivery-method-toggle";

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

type FieldErrors = Partial<Record<keyof ShippingInfo, string>>;

interface ServiceFeeDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export default function CheckoutPage() {
  const { cart, clearCart, getCartTotal, applyServerPrices } = useCart();
  const { user } = useAuth();
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountInfo | undefined>(undefined);
  const [serviceFeeDiscount, setServiceFeeDiscount] = useState<ServiceFeeDiscount | undefined>(undefined);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    apartment: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  });

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("shipping");
  const [showApartment, setShowApartment] = useState(false);
  const [spendCampaign, setSpendCampaign] = useState<SpendCampaign | null>(null);

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

  // Hold the page behind the spinner until Stripe says whether Apple Pay or
  // Google Pay will show, so the button doesn't pop in after the page appears.
  // The limit means a slow wallet check can never block paying by card.
  const [walletsSettled, setWalletsSettled] = useState(false);
  const settleWallets = useCallback(() => setWalletsSettled(true), []);

  useEffect(() => {
    const limit = window.setTimeout(settleWallets, 3000);

    return () => window.clearTimeout(limit);
  }, [settleWallets]);

  // Spend & Save campaign, for previewing the discount. The server works the
  // discount out again when the payment is created and charges its own figure.
  useEffect(() => {
    fetch("/api/spend-campaign")
      .then((res) => res.json())
      .then((data) => setSpendCampaign(data.campaign ?? null))
      .catch(() => console.error("Failed to fetch spend campaign"));
  }, []);

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
    setShippingInfo((prev) => {
      // Each country has its own states and postal format
      if (field === "country") return { ...prev, country: value, state: "", zipCode: "" };

      return { ...prev, [field]: value };
    });
    // A fix clears the message straight away; the next check runs on leaving the field
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Errors by field for the current details
  const checkFields = (info: ShippingInfo): FieldErrors => {
    const errors: FieldErrors = {
      firstName: nameError(info.firstName, "first name") ?? undefined,
      lastName: nameError(info.lastName, "last name") ?? undefined,
      email: emailError(info.email) ?? undefined,
      phone: phoneError(info.phone, info.country) ?? undefined,
    };

    if (deliveryMethod === "shipping") {
      const address = addressErrors({
        line1: info.address,
        apartment: info.apartment,
        city: info.city,
        state: info.state,
        postalCode: info.zipCode,
        country: info.country,
      });

      errors.address = address.line1;
      errors.apartment = address.apartment;
      errors.city = address.city;
      errors.state = address.state;
      errors.zipCode = address.postalCode;
      errors.country = address.country;
    }

    return errors;
  };

  // Checks one field when the customer leaves it, and tidies what they typed
  const handleFieldBlur = (field: keyof ShippingInfo) => {
    setFieldErrors((prev) => ({ ...prev, [field]: checkFields(shippingInfo)[field] }));

    if (field === "zipCode" && shippingInfo.zipCode) {
      setShippingInfo((prev) => ({
        ...prev,
        zipCode: normalizePostalCode(prev.zipCode, prev.country),
      }));
    }
  };

  const fieldProps = (field: keyof ShippingInfo) => ({
    "aria-describedby": fieldErrors[field] ? `${field}-error` : undefined,
    "aria-invalid": Boolean(fieldErrors[field]),
    className: `w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 ${
      fieldErrors[field]
        ? "border-red-500 dark:border-red-500"
        : "border-gray-300 dark:border-gray-700"
    }`,
    onBlur: () => handleFieldBlur(field),
  });

  const fieldError = (field: keyof ShippingInfo) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400" id={`${field}-error`}>
        {fieldErrors[field]}
      </p>
    ) : null;

  const handlePromoApplied = (discount: DiscountInfo, serviceFeeDiscountData?: ServiceFeeDiscount) => {
    setAppliedDiscount(discount);
    setServiceFeeDiscount(serviceFeeDiscountData);
  };

  const handlePromoRemoved = () => {
    setAppliedDiscount(undefined);
    setServiceFeeDiscount(undefined);
  };

  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;

    const subtotal = getCartTotal();
    if (appliedDiscount.discountAmount !== undefined) {
      return appliedDiscount.discountAmount;
    }

    if (appliedDiscount.type === "percentage") {
      return (subtotal * appliedDiscount.value) / 100;
    } else if (appliedDiscount.type === "fixed") {
      return appliedDiscount.value;
    }

    return 0;
  };

  const getServiceFeeCalculation = () => {
    const subtotal = getCartTotal();
    return calculateServiceFee(subtotal, serviceFeeDiscount);
  };

  const getCampaignDiscount = () => getSpendDiscount(getCartTotal(), spendCampaign).discount;

  const getDiscountedTotal = () => {
    const subtotal = getCartTotal();
    const discount = calculateDiscount();
    const serviceFeeCalc = getServiceFeeCalculation();
    // Discounts reduce the items only, never the fee — same as the server.
    return Math.max(0, subtotal - discount - getCampaignDiscount()) + serviceFeeCalc.finalServiceFee;
  };

  // Creates the order and the payment, for the card form and the wallets alike.
  // Returns null, with the reason shown on the page, if it can't go ahead.
  const createPayment = async (details: CustomerDetails): Promise<string | null> => {
    const { response, result } = await requestPayment({
      items: cart,
      details,
      deliveryMethod,
      expectedTotal: getDiscountedTotal(),
      user,
      discountCode: appliedDiscount?.code,
    });

    // A price, the promo code or the Spend & Save offer changed since this
    // page was rendered. Nothing has been charged or ordered yet: pull in
    // the real figures so the summary matches, and let the customer decide.
    if (response.status === 409 && result?.totalChanged) {
      if (Array.isArray(result.prices)) applyServerPrices(result.prices);

      if (appliedDiscount && typeof result.discountAmount === "number") {
        setAppliedDiscount({ ...appliedDiscount, discountAmount: result.discountAmount });
      }

      const res = await fetch("/api/spend-campaign").catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;

      setSpendCampaign(data?.campaign ?? null);
      setPaymentError(
        `Your total has changed to $${Number(result.total).toFixed(2)} because a price or offer changed. Please review your order and pay again.`,
      );

      return null;
    }

    if (!response.ok || !result?.clientSecret) {
      // Server messages here are written for the customer (out of stock,
      // retired product, promo code no longer valid).
      setPaymentError(result?.error || "We couldn't start your payment. Please try again.");

      return null;
    }
    return result.clientSecret as string;
  };

  const finishOrder = (paymentIntentId: string) => {
    clearCart();
    window.location.href = `/order/success?payment_intent=${paymentIntentId}`;
  };

  const handlePayment = async () => {
    if (!stripe || !elements) {
      setPaymentError("Stripe is not ready yet. Please wait and try again.");
      return;
    }

    setPaymentError(null); // Clear any previous errors

    const errors = checkFields(shippingInfo);

    setFieldErrors(errors);

    const firstProblem = (Object.keys(errors) as (keyof ShippingInfo)[]).find(
      (field) => errors[field],
    );

    if (firstProblem) {
      setPaymentError("Please fix the highlighted fields.");
      document.getElementById(firstProblem)?.focus();

      return;
    }

    setIsProcessing(true);

    try {
      const clientSecret = await createPayment({
        name: `${cleanText(shippingInfo.firstName)} ${cleanText(shippingInfo.lastName)}`,
        email: normalizeEmail(shippingInfo.email),
        phone: normalizePhone(shippingInfo.phone, shippingInfo.country),
        address: {
          line1: cleanText(shippingInfo.address),
          apartment: cleanText(shippingInfo.apartment),
          city: cleanText(shippingInfo.city),
          state: normalizeRegion(shippingInfo.state, shippingInfo.country),
          postalCode: normalizePostalCode(shippingInfo.zipCode, shippingInfo.country),
          country: shippingInfo.country,
        },
      });

      if (!clientSecret) return;

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement("card"),
            // Recorded on the payment in Stripe, alongside the card and its ZIP
            billing_details: {
              name: `${cleanText(shippingInfo.firstName)} ${cleanText(shippingInfo.lastName)}`,
              email: normalizeEmail(shippingInfo.email),
              phone: normalizePhone(shippingInfo.phone, shippingInfo.country),
            },
          },
        },
      );

      if (error) {
        setPaymentError(`Payment failed: ${error.message}`);
      } else if (paymentIntent?.status === "succeeded") {
        finishOrder(paymentIntent.id);
      }
    } catch (error) {
      setPaymentError("An error occurred during payment processing. Please try again.");
      console.error("Payment error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = getCartTotal();
  const discount = calculateDiscount();
  const serviceFeeCalc = getServiceFeeCalculation();
  const serviceFeeDisplay = formatServiceFeeDisplay(serviceFeeCalc);
  const total = getDiscountedTotal();
  const campaign = getSpendDiscount(subtotal, spendCampaign);
  // In cents for the wallets. Worked out from the total so the lines always add up.
  const totalCents = Math.round(total * 100);
  const feeCents = Math.min(totalCents, Math.round(serviceFeeCalc.finalServiceFee * 100));

  return (
    <div className="container mx-auto px-4 py-8">
      {!walletsSettled && (
        <div
          aria-label="Loading checkout"
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#160c08]"
          role="status"
        >
          <CircularTextSpinner size={260} />
        </div>
      )}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shipping and Payment Forms */}
          <div className="space-y-8">
            {/* How the order gets to them, chosen first because it decides what
                the wallets and the form below need to ask for */}
            <div className="space-y-4">
              <DeliveryMethodToggle
                value={deliveryMethod}
                onChange={(method) => {
                  setDeliveryMethod(method);
                  setFieldErrors({});
                  setPaymentError(null);
                }}
              />
            </div>

            <ExpressCheckout
              allowedCountries={["US", "CA"]}
              createPayment={createPayment}
              feeCents={feeCents}
              itemsCents={totalCents - feeCents}
              needsShippingAddress={deliveryMethod === "shipping"}
              totalCents={totalCents}
              onError={setPaymentError}
              onPaid={finishOrder}
              onSettled={settleWallets}
            />

            {/* Wallet problems are shown up here, next to the wallet buttons. The
                same message also shows by the card form's Pay button. */}
            {paymentError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{paymentError}</p>
              </div>
            )}

            {/* Shipping Information */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {deliveryMethod === "shipping"
                    ? "Shipping Information"
                    : "Contact Information"}
                </h2>
              </div>

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
                    {...fieldProps("firstName")}
                    autoComplete="given-name"
                    id="firstName"
                    type="text"
                    value={shippingInfo.firstName}
                    onChange={(e) =>
                      handleShippingChange("firstName", e.target.value)
                    }
                  />
                  {fieldError("firstName")}
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
                    {...fieldProps("lastName")}
                    autoComplete="family-name"
                    id="lastName"
                    type="text"
                    value={shippingInfo.lastName}
                    onChange={(e) =>
                      handleShippingChange("lastName", e.target.value)
                    }
                  />
                  {fieldError("lastName")}
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
                  {...fieldProps("email")}
                  autoCapitalize="none"
                  autoComplete="email"
                  inputMode="email"
                  id="email"
                  type="email"
                  value={shippingInfo.email}
                  onChange={(e) =>
                    handleShippingChange("email", e.target.value)
                  }
                />
                {fieldError("email")}
                {emailTypoSuggestion(shippingInfo.email) && (
                  <button
                    className="mt-1 block text-left text-sm text-amber-700 underline dark:text-amber-400"
                    type="button"
                    onClick={() =>
                      handleShippingChange("email", emailTypoSuggestion(shippingInfo.email)!)
                    }
                  >
                    Did you mean {emailTypoSuggestion(shippingInfo.email)}?
                  </button>
                )}
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
                  {...fieldProps("phone")}
                  autoComplete="tel"
                  inputMode="tel"
                  id="phone"
                  type="tel"
                  value={shippingInfo.phone}
                  onChange={(e) =>
                    handleShippingChange("phone", e.target.value)
                  }
                />
                {fieldError("phone")}
              </div>

              {deliveryMethod === "shipping" && (
                <>
                  {/* Address field */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      htmlFor="address"
                    >
                      Address
                    </label>
                    <input
                      required
                      {...fieldProps("address")}
                      autoComplete="address-line1"
                      id="address"
                      type="text"
                      value={shippingInfo.address}
                      onChange={(e) =>
                        handleShippingChange("address", e.target.value)
                      }
                    />
                    {fieldError("address")}
                  </div>

                  {/* Progressive apartment reveal */}
                  {!showApartment ? (
                    <button
                      type="button"
                      onClick={() => setShowApartment(true)}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                    >
                      + Add apt, suite, floor
                    </button>
                  ) : (
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        htmlFor="apartment"
                      >
                        Apt, Suite, Floor (optional)
                      </label>
                      <input
                        {...fieldProps("apartment")}
                        autoComplete="address-line2"
                        id="apartment"
                        type="text"
                        value={shippingInfo.apartment}
                        onChange={(e) =>
                          handleShippingChange("apartment", e.target.value)
                        }
                      />
                      {fieldError("apartment")}
                    </div>
                  )}

                  {/* City / State / ZIP grid */}
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
                        {...fieldProps("city")}
                        autoComplete="address-level2"
                        id="city"
                        type="text"
                        value={shippingInfo.city}
                        onChange={(e) =>
                          handleShippingChange("city", e.target.value)
                        }
                      />
                      {fieldError("city")}
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        htmlFor="state"
                      >
                        {shippingInfo.country === "CA" ? "Province" : "State"}
                      </label>
                      {regionsFor(shippingInfo.country) ? (
                        <select
                          required
                          {...fieldProps("state")}
                          autoComplete="address-level1"
                          id="state"
                          value={shippingInfo.state}
                          onChange={(e) => handleShippingChange("state", e.target.value)}
                        >
                          <option value="">Select</option>
                          {Object.entries(regionsFor(shippingInfo.country)!).map(([code, name]) => (
                            <option key={code} value={code}>
                              {name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          required
                          {...fieldProps("state")}
                          autoComplete="address-level1"
                          id="state"
                          type="text"
                          value={shippingInfo.state}
                          onChange={(e) => handleShippingChange("state", e.target.value)}
                        />
                      )}
                      {fieldError("state")}
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        htmlFor="zipCode"
                      >
                        {shippingInfo.country === "US" ? "ZIP Code" : "Postal Code"}
                      </label>
                      <input
                        required
                        {...fieldProps("zipCode")}
                        autoComplete="postal-code"
                        inputMode={shippingInfo.country === "US" || shippingInfo.country === "MX" ? "numeric" : "text"}
                        id="zipCode"
                        type="text"
                        value={shippingInfo.zipCode}
                        onChange={(e) =>
                          handleShippingChange("zipCode", e.target.value)
                        }
                      />
                      {fieldError("zipCode")}
                    </div>
                  </div>

                  {/* Country select */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      htmlFor="country"
                    >
                      Country
                    </label>
                    <select
                      required
                      {...fieldProps("country")}
                      autoComplete="country"
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
                </>
              )}
            </div>

            {/* Payment Form */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Payment Information</h2>

              <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
                <StripePaymentForm onReady={handleStripeReady} />

                {paymentError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-700">{paymentError}</p>
                  </div>
                )}

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
              {cart.map((item, index) => (
                <div
                  key={`${item.product._id}-${item.selectedVariant?.sku || index}`}
                  className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg"
                >
                  {item.product.mainImage && (
                    <div className="w-16 h-16 relative flex-shrink-0">
                      <Image
                        fill
                        alt={item.product.name}
                        sizes="64px"
                        className="object-cover rounded-md"
                        src={productImageUrl(
                          productPhotoForColor(item.product, item.selectedVariant?.color),
                          128,
                          item.product.imageDisplay,
                        )}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium">
                      {item.product.name}
                      {item.bundle && (
                        <span className="ml-2 align-middle text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black">
                          Bundle
                        </span>
                      )}
                    </h3>
                    {item.bundle && (
                      <ul className="text-sm text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                        {item.bundle.selections.map((sel) => (
                          <li key={`${sel.productId}-${sel.sku}`}>
                            {sel.quantity > 1 ? `${sel.quantity}× ` : ""}
                            {sel.productName}
                            {sel.size ? ` — ${sel.size}` : ""}
                            {sel.color ? ` / ${sel.color}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.selectedVariant && (item.selectedVariant.size || item.selectedVariant.color) && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.selectedVariant.size && `Size: ${item.selectedVariant.size}`}
                        {item.selectedVariant.size && item.selectedVariant.color && " • "}
                        {item.selectedVariant.color && `Color: ${item.selectedVariant.color}`}
                      </p>
                    )}
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

            {/* Promo Code Section */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
              <PromoCode
                onPromoApplied={handlePromoApplied}
                onPromoRemoved={handlePromoRemoved}
                appliedPromo={appliedDiscount}
                orderTotal={subtotal}
                userId={user?.uid}
              />
            </div>

            {/* Order Totals */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span>Fulfillment:</span>
                <span>
                  {deliveryMethod === "inperson" ? "In Person" : "Shipping"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              {appliedDiscount && discount > 0 && (
                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span>Discount ({appliedDiscount.code}):</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}

              {campaign.discount > 0 && spendCampaign && (
                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span>{spendCampaign.name}:</span>
                  <span>-${campaign.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span>Service Fee ({getServiceFeePercentage()}%):</span>
                <span>{serviceFeeDisplay.baseServiceFeeText}</span>
              </div>

              {serviceFeeCalc.discountApplied && serviceFeeDisplay.serviceFeeDiscountText && (
                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span>Service Fee Discount ({appliedDiscount?.code}):</span>
                  <span>{serviceFeeDisplay.serviceFeeDiscountText}</span>
                </div>
              )}

              {serviceFeeCalc.discountApplied && (
                <div className="flex justify-between items-center">
                  <span>Final Service Fee:</span>
                  <span>{serviceFeeDisplay.finalServiceFeeText}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t border-gray-200 dark:border-gray-800">
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
