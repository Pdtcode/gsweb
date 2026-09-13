import { SVGProps } from "react";
import { SanityImageObject } from "@sanity/image-url/lib/types/types";
import { PortableTextBlock } from "@portabletext/types";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export interface SanitySlug {
  _type: "slug";
  current: string;
}

// Author
export interface Author {
  _id: string;
  _type: "author";
  name: string;
  image?: SanityImageObject;
  bio?: PortableTextBlock[];
}

// Post
export interface Post {
  _id: string;
  _type: "post";
  title: string;
  slug: SanitySlug;
  mainImage?: SanityImageObject;
  publishedAt?: string;
  body?: PortableTextBlock[];
  excerpt?: string;
  estimatedReadingTime?: number;
  authorName?: string;
  authorImage?: SanityImageObject;
  authorBio?: PortableTextBlock[];
  categories?: Category[];
}

// Category
export interface Category {
  _id: string;
  _type: "category";
  title: string;
  slug: SanitySlug;
  description?: string;
  image?: SanityImageObject;
  order?: number;
  featured?: boolean;
}

// Collection
export interface Collection {
  _id: string;
  _type: "collection";
  title: string;
  slug: SanitySlug;
  description?: string;
  mainImage?: SanityImageObject;
  startDate?: string;
  endDate?: string;
  featured?: boolean;
  highlight?: boolean;
  collectionType?: "seasonal" | "limited" | "permanent" | "collaboration";
}

// Inventory Item
export interface InventoryItem {
  option: string;
  sku?: string;
  quantity: number;
  lowStockThreshold?: number;
}

// Product Variant
export interface ProductVariant {
  name: string;
  options: string[];
  inventory?: InventoryItem[];
}

// Available Variant for real-time inventory
export interface AvailableVariant {
  color: string;
  size: string;
  stock: number;
  sku: string;
}

// Product
export interface Product {
  _id: string;
  _type: "product";
  name: string;
  slug: SanitySlug;
  price: number;
  comparePrice?: number;
  description?: string;
  mainImage: SanityImageObject;
  images?: SanityImageObject[];
  categories: Category[];
  collections?: Collection[];
  inStock: boolean;
  featured?: boolean;
  publishedAt?: string;
  variants?: ProductVariant[];
  shopURL?: string;
  dropExclusive?: boolean;
  totalInventory?: number;
  sku?: string;
  lowStockAlert?: number;
  // Real-time inventory properties (optional)
  realTimeTotalInventory?: number;
  realTimeInStock?: boolean;
  availableVariants?: AvailableVariant[];
}

// --- Bundle Deals ---------------------------------------------------------
// A bundle holds NO stock of its own. It expands into its component products
// at order creation, so inventory is deducted per-component exactly as it is
// for a normal single-product order.

// One selectable variant of a bundle component, with live Neon stock
export interface BundleComponentVariant {
  sku: string;
  size: string;
  color: string | null;
  stock: number;
}

// A product inside a bundle, as returned by /api/bundles/[slug]
export interface BundleComponent {
  _id: string;
  name: string;
  slug: string;
  price: number;
  mainImage?: SanityImageObject;
  quantity: number;
  variants: BundleComponentVariant[];
  // True when the product has no variant dimensions (single default SKU)
  hasVariants: boolean;
}

export interface BundleDeal {
  _id: string;
  _type: "bundleDeal";
  name: string;
  slug: SanitySlug;
  description?: string;
  mainImage?: SanityImageObject;
  images?: SanityImageObject[];
  bundlePrice: number;
  featured?: boolean;
  components: BundleComponent[];
  // Sum of component list prices x quantity
  componentSum: number;
  savings: number;
  // How many complete bundles current stock can fulfil
  maxBundles: number;
}

// The customer's per-component variant choice, carried in the cart
export interface BundleSelection {
  productId: string;
  productSlug: string;
  productName: string;
  quantity: number;
  sku: string;
  size?: string;
  color?: string;
}
