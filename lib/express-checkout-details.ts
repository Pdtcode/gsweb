import {
  addressErrors,
  cleanText as clean,
  emailError,
  nameError,
  normalizeEmail,
  normalizePhone,
  normalizePostalCode,
  normalizeRegion,
} from "@/lib/checkout-validation";

// What the checkout needs from a customer, whichever way they pay: typed into
// the form, or supplied by Apple Pay / Google Pay.
export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  address?: {
    line1: string;
    apartment: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

// The shapes Stripe's Express Checkout confirm event provides
interface WalletAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface WalletConfirmEvent {
  billingDetails?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  shippingAddress?: {
    name?: string | null;
    address?: WalletAddress | null;
  };
}

export function walletDetailsToCustomer(
  event: WalletConfirmEvent,
  needsAddress: boolean,
): CustomerDetails {
  const shipping = event.shippingAddress;
  const billing = event.billingDetails;
  const address = shipping?.address;

  const country = clean(address?.country) || "US";

  return {
    name: clean(shipping?.name) || clean(billing?.name),
    email: normalizeEmail(billing?.email),
    // A number that can't be read is left blank rather than saved wrong
    phone: normalizePhone(billing?.phone, country),
    address:
      needsAddress && address
        ? {
            line1: clean(address.line1),
            apartment: clean(address.line2),
            city: clean(address.city),
            state: normalizeRegion(address.state, country),
            postalCode: normalizePostalCode(address.postal_code, country),
            country,
          }
        : undefined,
  };
}

// True only when a wallet gave everything an order needs, so a payment can never
// go through for an order that can't be fulfilled or contacted.
export function isCompleteForOrder(
  details: CustomerDetails,
  needsAddress: boolean,
): boolean {
  if (nameError(details.name) || emailError(details.email)) return false;
  if (!needsAddress) return true;
  if (!details.address) return false;

  return Object.keys(addressErrors(details.address)).length === 0;
}
