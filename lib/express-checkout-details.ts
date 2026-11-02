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

// The server splits the address on commas, so one inside a field would shift
// every field after it.
const clean = (value?: string | null) =>
  (value ?? "").replace(/,/g, " ").replace(/\s+/g, " ").trim();

export function walletDetailsToCustomer(
  event: WalletConfirmEvent,
  needsAddress: boolean,
): CustomerDetails {
  const shipping = event.shippingAddress;
  const billing = event.billingDetails;
  const address = shipping?.address;

  return {
    name: clean(shipping?.name) || clean(billing?.name),
    email: clean(billing?.email),
    phone: clean(billing?.phone),
    address:
      needsAddress && address
        ? {
            line1: clean(address.line1),
            apartment: clean(address.line2),
            city: clean(address.city),
            state: clean(address.state),
            postalCode: clean(address.postal_code),
            country: clean(address.country) || "US",
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
  if (!details.name || !details.email) return false;
  if (!needsAddress) return true;

  const a = details.address;

  return Boolean(a?.line1 && a.city && a.state && a.postalCode && a.country);
}
