import prisma from "@/lib/prismaClient";
import { client as sanityClient } from "@/sanity/lib/client";

/**
 * Bundle deals.
 *
 * A bundle is a Sanity-only construct. It has NO row in Neon and NO stock of
 * its own. At order creation a bundle cart line is expanded into one OrderItem
 * per component product, so the existing Stripe-webhook deduction path
 * (`decrementOrderStock`) deducts each component SKU exactly as it does for a
 * normal single-product order. Nothing in the deduction logic knows bundles
 * exist.
 *
 * Availability of a bundle is therefore derived, never stored:
 *   maxBundles = min over components of floor(componentStock / componentQty)
 */

// Only surface bundles that are active and inside their scheduling window
const ACTIVE_BUNDLE_FILTER = `
  _type == "bundleDeal"
  && isActive == true
  && (!defined(startDate) || startDate <= now())
  && (!defined(endDate) || endDate >= now())
  && count(items[product->isActive == false]) == 0
`;

const BUNDLE_PROJECTION = `
  _id,
  _type,
  name,
  slug,
  description,
  bundlePrice,
  featured,
  mainImage,
  images,
  "items": items[]{
    quantity,
    "product": product->{
      _id,
      name,
      "slug": slug.current,
      price,
      mainImage,
      imageDisplay
    }
  }
`;

export const ACTIVE_BUNDLES_QUERY = `
  *[${ACTIVE_BUNDLE_FILTER}] | order(featured desc, lower(name) asc) {
    ${BUNDLE_PROJECTION}
  }
`;

export const BUNDLE_BY_SLUG_QUERY = `
  *[${ACTIVE_BUNDLE_FILTER} && slug.current == $slug][0] {
    ${BUNDLE_PROJECTION}
  }
`;

export interface RawBundleItem {
  quantity?: number;
  product?: {
    _id: string;
    name: string;
    slug: string | null;
    price: number | null;
    mainImage?: any;
    imageDisplay?: any;
  } | null;
}

export interface RawBundle {
  _id: string;
  _type: "bundleDeal";
  name: string;
  slug: { current: string };
  description?: string;
  bundlePrice: number;
  featured?: boolean;
  mainImage?: any;
  images?: any[];
  items?: RawBundleItem[];
}

export interface ResolvedVariant {
  sku: string;
  size: string;
  color: string | null;
  stock: number;
}

export interface ResolvedComponent {
  _id: string;
  name: string;
  slug: string;
  price: number;
  mainImage?: any;
  imageDisplay?: any;
  quantity: number;
  variants: ResolvedVariant[];
  hasVariants: boolean;
  // Neon Product.id — needed to write OrderItem rows at checkout.
  // Null when the product has not been synced to Neon yet.
  neonProductId: string | null;
}

export interface ResolvedBundle {
  _id: string;
  _type: "bundleDeal";
  name: string;
  slug: { current: string };
  description?: string;
  mainImage?: any;
  imageDisplay?: any;
  images?: any[];
  bundlePrice: number;
  featured?: boolean;
  components: ResolvedComponent[];
  componentSum: number;
  savings: number;
  maxBundles: number;
}

// Garment sizes sort by physical size, not alphabetically — otherwise the
// picker reads "Large, Medium, Small, XL, XXL". Anything unrecognised keeps a
// stable alphabetical order after the known sizes.
const SIZE_ORDER = [
  "xxxs", "xxs", "xs", "s", "small",
  "m", "medium", "l", "large",
  "xl", "xxl", "xxxl", "4xl", "5xl",
  "one size", "os", "default",
];

function sizeRank(size: string): number {
  const key = size.trim().toLowerCase();
  const exact = SIZE_ORDER.indexOf(key);

  if (exact !== -1) return exact;

  // Tolerate spellings like "X-Large", "2XL", "Extra Large"
  const normalized = key
    .replace(/[\s._-]/g, "")
    .replace(/^extra/, "x")
    .replace(/^2x/, "xx")
    .replace(/^3x/, "xxx");

  const fuzzy = SIZE_ORDER.indexOf(normalized);

  return fuzzy !== -1 ? fuzzy : Number.MAX_SAFE_INTEGER;
}

export function compareSizes(a: string, b: string): number {
  const ra = sizeRank(a);
  const rb = sizeRank(b);

  if (ra !== rb) return ra - rb;

  return a.localeCompare(b);
}

/**
 * Look up the Neon product row for a Sanity product, mirroring the fallback
 * chain used at checkout (slug first, then id, then name).
 */
async function findNeonProduct(product: {
  _id: string;
  slug: string | null;
  name: string;
}) {
  if (product.slug) {
    const bySlug = await prisma.product.findFirst({
      where: { slug: product.slug },
      include: { ProductVariant: true },
    });

    if (bySlug) return bySlug;
  }

  const byId = await prisma.product.findFirst({
    where: { id: product._id },
    include: { ProductVariant: true },
  });

  if (byId) return byId;

  return prisma.product.findFirst({
    where: { name: product.name },
    include: { ProductVariant: true },
  });
}

/**
 * Attach live Neon stock to each component and derive bundle-level numbers.
 */
export async function resolveBundle(
  raw: RawBundle | null,
): Promise<ResolvedBundle | null> {
  if (!raw) return null;

  const items = (raw.items || []).filter((i) => i.product?._id);

  const components: ResolvedComponent[] = await Promise.all(
    items.map(async (item) => {
      const product = item.product!;
      const quantity = item.quantity ?? 1;

      const neonProduct = await findNeonProduct({
        _id: product._id,
        slug: product.slug,
        name: product.name,
      });

      const variants: ResolvedVariant[] = (neonProduct?.ProductVariant ?? [])
        .map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
        }))
        .sort((a, b) => compareSizes(a.size, b.size));

      // A single "Default" variant means the product is not really sized
      const hasVariants = !(
        variants.length === 0 ||
        (variants.length === 1 && variants[0].size === "Default")
      );

      return {
        _id: product._id,
        name: product.name,
        slug: product.slug ?? product._id,
        price: product.price ?? 0,
        mainImage: product.mainImage,
        imageDisplay: product.imageDisplay,
        quantity,
        variants,
        hasVariants,
        neonProductId: neonProduct?.id ?? null,
      };
    }),
  );

  const componentSum = components.reduce(
    (sum, c) => sum + c.price * c.quantity,
    0,
  );

  // Best case availability: the single richest variant of each component.
  // (The real cap depends on which variants the customer picks; the storefront
  // recomputes that from the selected SKUs.)
  const maxBundles = components.length
    ? Math.min(
        ...components.map((c) => {
          const best = c.variants.reduce((m, v) => Math.max(m, v.stock), 0);

          return Math.floor(best / c.quantity);
        }),
      )
    : 0;

  return {
    _id: raw._id,
    _type: raw._type,
    name: raw.name,
    slug: raw.slug,
    description: raw.description,
    mainImage: raw.mainImage || components[0]?.mainImage,
    // When falling back to a component's photo, inherit its sizing too
    imageDisplay: raw.mainImage ? undefined : components[0]?.imageDisplay,
    images: raw.images,
    bundlePrice: raw.bundlePrice,
    featured: raw.featured,
    components,
    componentSum,
    savings: componentSum - raw.bundlePrice,
    maxBundles: Number.isFinite(maxBundles) ? maxBundles : 0,
  };
}

export async function getActiveBundles(): Promise<ResolvedBundle[]> {
  const raw: RawBundle[] = await sanityClient.fetch(ACTIVE_BUNDLES_QUERY);
  const resolved = await Promise.all(raw.map((b) => resolveBundle(b)));

  return resolved.filter((b): b is ResolvedBundle => b !== null);
}

export async function getBundleBySlug(
  slug: string,
): Promise<ResolvedBundle | null> {
  const raw: RawBundle | null = await sanityClient.fetch(BUNDLE_BY_SLUG_QUERY, {
    slug,
  });

  return resolveBundle(raw);
}

// --- Price allocation -----------------------------------------------------

export interface AllocationLine {
  productId: string;
  productSlug: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface AllocationInput {
  productId: string;
  productSlug: string;
  productName: string;
  sku: string;
  quantity: number;
  listPrice: number;
}

/**
 * Split a bundle's fixed price across its components so the OrderItem rows sum
 * to exactly the bundle price — no drifting cent, which would otherwise make
 * the order total disagree with the Stripe charge.
 *
 * Allocation is proportional to each component's list-price line total, using
 * largest-remainder to place leftover cents. Because OrderItem.price is a
 * PER-UNIT decimal, a component whose allocated line total is not divisible by
 * its quantity is emitted as two rows (one cent apart). Both rows carry the
 * same SKU, so stock deduction is unaffected.
 *
 * Returns lines for ONE bundle; callers multiply quantities by the number of
 * bundles purchased, which keeps the sum exact.
 */
export function allocateBundlePrice(
  bundlePrice: number,
  components: AllocationInput[],
): AllocationLine[] {
  const bundleCents = Math.round(bundlePrice * 100);

  if (components.length === 0) return [];

  const weights = components.map((c) => Math.round(c.listPrice * 100) * c.quantity);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Fall back to an even split across units when list prices are unusable
  const effectiveWeights =
    weightSum > 0 ? weights : components.map((c) => c.quantity);
  const effectiveSum = effectiveWeights.reduce((a, b) => a + b, 0) || 1;

  // Largest-remainder apportionment of bundleCents across component lines
  const exact = effectiveWeights.map((w) => (bundleCents * w) / effectiveSum);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = bundleCents - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const lineCents = [...floored];

  for (let k = 0; k < order.length && remainder > 0; k++) {
    lineCents[order[k].i] += 1;
    remainder -= 1;
  }

  // Any residue (possible only with degenerate inputs) lands on the first line
  if (remainder !== 0) lineCents[0] += remainder;

  // Convert each component line total into per-unit rows
  const lines: AllocationLine[] = [];

  components.forEach((c, i) => {
    const total = lineCents[i];
    const qty = c.quantity;
    const base = Math.floor(total / qty);
    const extra = total - base * qty; // 0 <= extra < qty

    if (extra > 0) {
      lines.push({
        productId: c.productId,
        productSlug: c.productSlug,
        productName: c.productName,
        sku: c.sku,
        quantity: extra,
        unitPriceCents: base + 1,
      });
    }

    if (qty - extra > 0) {
      lines.push({
        productId: c.productId,
        productSlug: c.productSlug,
        productName: c.productName,
        sku: c.sku,
        quantity: qty - extra,
        unitPriceCents: base,
      });
    }
  });

  return lines;
}

// --- Checkout validation --------------------------------------------------

export interface ClientBundleSelection {
  productId: string;
  productSlug?: string;
  quantity: number;
  sku: string;
  size?: string | null;
  color?: string | null;
}

export interface BundleExpansion {
  bundle: ResolvedBundle;
  // Allocation lines for ONE bundle; multiply quantity by the number of
  // bundles purchased to get the OrderItem rows.
  lines: AllocationLine[];
  neonProductIdBySku: Record<string, string>;
}

export interface BundleValidationResult {
  ok: boolean;
  error?: string;
  expansion?: BundleExpansion;
}

/**
 * Re-read a bundle from Sanity and verify a client-submitted selection against
 * it, then produce the per-component price allocation.
 *
 * Everything price- and stock-related is taken from the server side; the client
 * payload is used only to learn WHICH variant the customer picked.
 */
export async function validateAndExpandBundle(
  slug: string,
  selections: ClientBundleSelection[],
  bundleQuantity: number,
): Promise<BundleValidationResult> {
  if (!slug) return { ok: false, error: "Bundle slug is required" };

  if (!Number.isInteger(bundleQuantity) || bundleQuantity < 1) {
    return { ok: false, error: "Invalid bundle quantity" };
  }

  const bundle = await getBundleBySlug(slug);

  if (!bundle) {
    return { ok: false, error: `Bundle "${slug}" is not available` };
  }

  if (bundle.components.length < 2) {
    return { ok: false, error: `Bundle "${bundle.name}" is misconfigured` };
  }

  const allocationInputs: AllocationInput[] = [];
  const neonProductIdBySku: Record<string, string> = {};

  for (const component of bundle.components) {
    // Exactly one selection per component product
    const matches = (selections || []).filter(
      (s) => s.productId === component._id,
    );

    if (matches.length !== 1) {
      return {
        ok: false,
        error: `Choose an option for "${component.name}"`,
      };
    }

    const selection = matches[0];

    if (!component.neonProductId) {
      return {
        ok: false,
        error: `"${component.name}" is not available for purchase yet`,
      };
    }

    // The SKU must genuinely belong to this component product
    const variant = component.variants.find((v) => v.sku === selection.sku);

    if (!variant) {
      return {
        ok: false,
        error: `The selected option for "${component.name}" is no longer available`,
      };
    }

    // Component quantity comes from Sanity, never from the client
    const needed = component.quantity * bundleQuantity;

    if (variant.stock < needed) {
      return {
        ok: false,
        error: `Only ${variant.stock} left of "${component.name}" (${variant.size}) — need ${needed}`,
      };
    }

    neonProductIdBySku[variant.sku] = component.neonProductId;

    allocationInputs.push({
      productId: component.neonProductId,
      productSlug: component.slug,
      productName: component.name,
      sku: variant.sku,
      quantity: component.quantity,
      listPrice: component.price,
    });
  }

  // Reject stray selections for products not in the bundle
  const componentIds = new Set(bundle.components.map((c) => c._id));
  const stray = (selections || []).find((s) => !componentIds.has(s.productId));

  if (stray) {
    return { ok: false, error: "Bundle contents do not match" };
  }

  const lines = allocateBundlePrice(bundle.bundlePrice, allocationInputs);

  return { ok: true, expansion: { bundle, lines, neonProductIdBySku } };
}
