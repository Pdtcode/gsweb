"use client";

import { useEffect, useState } from "react";
import {
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { stripePromise } from "@/components/stripe-payment-form";
import {
  type CustomerDetails,
  isCompleteForOrder,
  walletDetailsToCustomer,
} from "@/lib/express-checkout-details";

interface ExpressCheckoutProps {
  // Everything in cents. Item and fee lines must add up to the total.
  totalCents: number;
  itemsCents: number;
  feeCents: number;
  needsShippingAddress: boolean;
  allowedCountries: string[];
  // Creates the order and payment. Returns null, after showing the customer why,
  // if it can't go ahead.
  createPayment: (details: CustomerDetails) => Promise<string | null>;
  onPaid: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  // Called once we know whether a wallet will show, so checkout can appear with
  // the button already in place
  onSettled: () => void;
}

function ExpressButtons({
  totalCents,
  itemsCents,
  feeCents,
  needsShippingAddress,
  allowedCountries,
  createPayment,
  onPaid,
  onError,
  onSettled,
  onAvailable,
}: ExpressCheckoutProps & { onAvailable: (available: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();

  return (
    <ExpressCheckoutElement
      options={{
        // Only the two wallets: everything else stays with the card form
        paymentMethods: {
          applePay: "auto",
          googlePay: "auto",
          amazonPay: "never",
          klarna: "never",
          link: "never",
          paypal: "never",
        },
        buttonType: { applePay: "buy", googlePay: "buy" },
        buttonHeight: 48,
      }}
      onClick={({ resolve }) => {
        resolve({
          emailRequired: true,
          phoneNumberRequired: true,
          lineItems: [
            { name: "Items", amount: itemsCents },
            { name: "Service fee", amount: feeCents },
          ],
          ...(needsShippingAddress
            ? {
                shippingAddressRequired: true,
                allowedShippingCountries: allowedCountries,
                shippingRates: [
                  { id: "free", displayName: "Free shipping", amount: 0 },
                ],
              }
            : {}),
        });
      }}
      onLoadError={onSettled}
      onReady={({ availablePaymentMethods }) => {
        onAvailable(
          Boolean(
            availablePaymentMethods?.applePay ||
              availablePaymentMethods?.googlePay,
          ),
        );
        onSettled();
      }}
      onConfirm={async (event) => {
        if (!stripe || !elements) {
          event.paymentFailed({ reason: "fail" });

          return;
        }

        const fail = (message: string) => {
          onError(message);
          event.paymentFailed({ reason: "fail" });
        };

        const { error: submitError } = await elements.submit();

        if (submitError) {
          fail(submitError.message ?? "We couldn't start your payment.");

          return;
        }

        const details = walletDetailsToCustomer(event, needsShippingAddress);

        // Checked before anything is created or charged
        if (!isCompleteForOrder(details, needsShippingAddress)) {
          fail(
            "Your wallet didn't share everything we need for this order. Please check its details, or pay by card below.",
          );

          return;
        }

        const clientSecret = await createPayment(details);

        if (!clientSecret) {
          event.paymentFailed({ reason: "fail" });

          return;
        }

        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            // Only used if the bank requires a redirect to approve the payment
            return_url: `${window.location.origin}/order/success`,
          },
          redirect: "if_required",
        });

        if (error) {
          fail(`Payment failed: ${error.message}`);

          return;
        }

        if (paymentIntent) onPaid(paymentIntent.id);
      }}
    />
  );
}

// Apple Pay / Google Pay buttons. Stays out of the page entirely when the
// customer's device has neither set up, leaving just the card form.
export function ExpressCheckout(props: ExpressCheckoutProps) {
  const [available, setAvailable] = useState(false);
  const noWallets = props.totalCents <= 0;
  const { onSettled } = props;

  useEffect(() => {
    if (noWallets) onSettled();
  }, [noWallets, onSettled]);

  if (noWallets) return null;

  return (
    <div className="space-y-4">
      {/* Hidden with visibility, not display: none, as Stripe's docs do. The
          element has to keep its size to load and report which wallets exist. */}
      <div style={{ visibility: available ? "visible" : "hidden" }}>
        <Elements
          options={{
            mode: "payment",
            amount: props.totalCents,
            currency: "usd",
            // Must match the payment the server creates
            paymentMethodTypes: ["card"],
          }}
          stripe={stripePromise}
        >
          <ExpressButtons {...props} onAvailable={setAvailable} />
        </Elements>
      </div>
      {available && (
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          Or pay by card
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        </div>
      )}
    </div>
  );
}
