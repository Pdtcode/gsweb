// Rules for customer details at checkout, shared by the form, the wallets and the
// server so they can't disagree. No server imports, so the browser can use it.

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  AA: "Armed Forces Americas", AE: "Armed Forces Europe", AP: "Armed Forces Pacific",
};

export const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};

export const regionsFor = (country: string): Record<string, string> | null =>
  country === "US" ? US_STATES : country === "CA" ? CA_PROVINCES : null;

// The server splits the address on commas, so one inside a field would shift
// every field after it.
export const cleanText = (value?: string | null) =>
  (value ?? "").replace(/,/g, " ").replace(/\s+/g, " ").trim();

export const normalizeEmail = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

// "Oklahoma" and "ok" both become "OK"
export function normalizeRegion(value: string | null | undefined, country: string) {
  const cleaned = cleanText(value);
  const regions = regionsFor(country);

  if (!regions) return cleaned;

  const upper = cleaned.toUpperCase();

  if (regions[upper]) return upper;

  const byName = Object.entries(regions).find(
    ([, name]) => name.toUpperCase() === upper,
  );

  return byName ? byName[0] : cleaned;
}

export function normalizePostalCode(value: string | null | undefined, country: string) {
  const cleaned = cleanText(value).toUpperCase();

  if (country === "CA") {
    const compact = cleaned.replace(/[\s-]/g, "");

    return compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : cleaned;
  }

  return cleaned;
}

// To +14055550100. Returns "" if it can't be a phone number.
export function normalizePhone(value?: string | null, country = "US") {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const dialCode = country === "MX" ? "52" : "1";

  if (raw.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  }
  if (digits.length === 10) return `+${dialCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;
const POSTAL_PATTERNS: Record<string, { pattern: RegExp; message: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, message: "Enter a 5-digit ZIP code." },
  CA: { pattern: /^[A-Z]\d[A-Z] \d[A-Z]\d$/, message: "Enter a postal code like K1A 0B1." },
  MX: { pattern: /^\d{5}$/, message: "Enter a 5-digit postal code." },
};

const hasLetter = (value: string) => /\p{L}/u.test(value);

export function nameError(value: string, label = "name") {
  const cleaned = cleanText(value);

  if (!cleaned) return `Enter your ${label}.`;
  if (cleaned.length > 80 || !hasLetter(cleaned) || /[@<>]|https?:/i.test(cleaned)) {
    return `Enter a valid ${label}.`;
  }

  return null;
}

export function emailError(value: string) {
  const email = normalizeEmail(value);

  if (!email) return "Enter your email so we can send your order confirmation.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email, like name@example.com.";
  }

  return null;
}

export function phoneError(value: string, country = "US") {
  if (!value.trim()) return "Enter your phone number.";

  return normalizePhone(value, country)
    ? null
    : "Enter a valid phone number, including the area code.";
}

export interface AddressFields {
  line1: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Errors by field, empty when the address is good
export function addressErrors(address: AddressFields): Partial<Record<keyof AddressFields, string>> {
  const errors: Partial<Record<keyof AddressFields, string>> = {};
  const line1 = cleanText(address.line1);
  const city = cleanText(address.city);
  const country = address.country;
  const regions = regionsFor(country);
  const state = normalizeRegion(address.state, country);
  const postal = normalizePostalCode(address.postalCode, country);
  const postalRule = POSTAL_PATTERNS[country];

  if (!["US", "CA", "MX"].includes(country)) errors.country = "We can't ship to this country yet.";

  if (!line1) errors.line1 = "Enter your street address.";
  else if (line1.length > 100 || !hasLetter(line1) || !/\d/.test(line1)) {
    errors.line1 = "Enter your full street address, including the number.";
  }

  if (cleanText(address.apartment).length > 40) errors.apartment = "Keep this under 40 characters.";

  if (!city) errors.city = "Enter your city.";
  else if (city.length > 60 || !hasLetter(city) || /\d/.test(city)) errors.city = "Enter a valid city.";

  if (!state) errors.state = country === "CA" ? "Choose your province." : "Choose your state.";
  else if (regions ? !regions[state] : state.length > 60 || !hasLetter(state)) {
    errors.state = country === "CA" ? "Choose a valid province." : "Choose a valid state.";
  }

  if (!postal) errors.postalCode = country === "US" ? "Enter your ZIP code." : "Enter your postal code.";
  else if (postalRule && !postalRule.pattern.test(postal)) errors.postalCode = postalRule.message;

  return errors;
}

// A nudge, not a blocker: a real address could use one of these domains.
const EMAIL_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "outlok.com": "outlook.com",
  "iclod.com": "icloud.com", "icloud.con": "icloud.com",
};

export function emailTypoSuggestion(value: string) {
  const email = normalizeEmail(value);
  const [user, domain] = email.split("@");

  return domain && EMAIL_TYPOS[domain] ? `${user}@${EMAIL_TYPOS[domain]}` : null;
}

// The stored form of "line1, city, state, postal, country": "Oklahoma" is saved as "OK"
export function normalizeShippingAddress(value: string) {
  const parts = value.split(",").map((part) => part.trim());

  if (parts.length !== 5) return value;

  const [line1, city, state, postal, country] = parts;

  return [
    line1,
    city,
    normalizeRegion(state, country),
    normalizePostalCode(postal, country),
    country,
  ].join(", ");
}

// The server's last check before anything is created or charged. Returns a message
// for the customer, or null. A blank phone is allowed because wallets can omit it;
// the form requires one itself.
export function serverDetailsError(input: {
  name?: string;
  email?: string;
  phone?: string;
  shippingAddress?: string;
  needsAddress: boolean;
}) {
  const nameProblem = nameError(input.name ?? "");

  if (nameProblem) return nameProblem;

  const emailProblem = emailError(input.email ?? "");

  if (emailProblem) return emailProblem;

  const parts = (input.shippingAddress ?? "").split(",").map((part) => part.trim());
  const country = input.needsAddress ? (parts[4] ?? "") : "US";

  if (input.phone?.trim() && !normalizePhone(input.phone, country)) {
    return "Enter a valid phone number, including the area code.";
  }

  if (input.needsAddress) {
    if (parts.length !== 5) return "Please check your shipping address.";

    const problems = addressErrors({
      line1: parts[0],
      city: parts[1],
      state: parts[2],
      postalCode: parts[3],
      country,
    });
    const first = Object.values(problems)[0];

    if (first) return first;
  }

  return null;
}
