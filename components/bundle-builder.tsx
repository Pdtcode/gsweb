"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useCart, type CartBundle } from "@/context/CartContext";
import { urlForImage } from "@/sanity/lib/image";
import { productImageUrl } from "@/lib/product-image";
import type {
  BundleComponent,
  BundleComponentVariant,
  BundleDeal,
  Product,
} from "@/types";

interface BundleBuilderProps {
  bundle: BundleDeal;
}

// A component is satisfied once a SKU is chosen. Products with a single
// "Default" variant are auto-selected and need no picker.
function autoSelectedSku(component: BundleComponent): string | null {
  if (!component.hasVariants && component.variants.length === 1) {
    return component.variants[0].sku;
  }

  return null;
}

// Show the colour only when size alone does not identify the variant — some
// products carry a placeholder colour ("Size") that would otherwise render as
// "Small / Size", while others (a hat in two colours) are only told apart by it.
function variantLabelParts(
  component: BundleComponent,
  variant: BundleComponentVariant,
): { size: string; color?: string } {
  const sameSizeCount = component.variants.filter(
    (v) => v.size === variant.size,
  ).length;

  return {
    size: variant.size,
    color: sameSizeCount > 1 && variant.color ? variant.color : undefined,
  };
}

function formatVariantLabel(
  component: BundleComponent,
  variant: BundleComponentVariant,
): string {
  const { size, color } = variantLabelParts(component, variant);

  return color ? `${size} / ${color}` : size;
}

export function BundleBuilder({ bundle }: BundleBuilderProps) {
  const { addBundleToCart } = useCart();

  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    bundle.components.forEach((c) => {
      const auto = autoSelectedSku(c);

      if (auto) initial[c._id] = auto;
    });

    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Every component needs a chosen SKU before the bundle can be added
  const allSelected = bundle.components.every((c) => selectedSkus[c._id]);

  // How many complete bundles the *chosen* SKUs can supply
  const maxAvailable = useMemo(() => {
    if (!allSelected) return 0;

    return Math.min(
      ...bundle.components.map((c) => {
        const variant = c.variants.find((v) => v.sku === selectedSkus[c._id]);

        if (!variant) return 0;

        return Math.floor(variant.stock / c.quantity);
      }),
    );
  }, [allSelected, bundle.components, selectedSkus]);

  const canAdd = allSelected && maxAvailable > 0;

  const handleSelect = (componentId: string, sku: string) => {
    setAdded(false);
    setSelectedSkus((prev) => ({ ...prev, [componentId]: sku }));
    setQuantity(1);
  };

  const handleAddToCart = () => {
    if (!canAdd) return;

    const selections = bundle.components.map((c) => {
      const variant = c.variants.find((v) => v.sku === selectedSkus[c._id])!;

      const label = variantLabelParts(c, variant);

      return {
        productId: c._id,
        productSlug: c.slug,
        productName: c.name,
        quantity: c.quantity,
        sku: variant.sku,
        size: label.size,
        color: label.color,
      };
    });

    const cartBundle: CartBundle = {
      bundleId: bundle._id,
      slug: bundle.slug.current,
      name: bundle.name,
      bundlePrice: bundle.bundlePrice,
      selections,
      maxAvailable,
    };

    // Synthetic product so existing cart/checkout UI renders the bundle line
    // without needing to know what a bundle is
    const syntheticProduct = {
      _id: bundle._id,
      _type: "product",
      name: bundle.name,
      slug: bundle.slug,
      price: bundle.bundlePrice,
      mainImage: bundle.mainImage,
      categories: [],
      inStock: true,
    } as unknown as Product;

    addBundleToCart(cartBundle, syntheticProduct, quantity);
    setAdded(true);
  };

  const effectiveMax = Math.max(1, Math.min(maxAvailable || 1, 10));

  return (
    <div className="space-y-8">
      {/* Pricing */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold">
            ${bundle.bundlePrice.toFixed(2)}
          </span>
          {bundle.savings > 0 && (
            <>
              <span className="text-lg text-gray-500 line-through">
                ${bundle.componentSum.toFixed(2)}
              </span>
              <span className="text-sm font-semibold px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Save ${bundle.savings.toFixed(2)}
              </span>
            </>
          )}
        </div>
        {bundle.description && (
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {bundle.description}
          </p>
        )}
      </div>

      {/* Per-component pickers */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Choose your options</h2>

        {bundle.components.map((component) => {
          const selected = selectedSkus[component._id];
          const needsPicker = component.hasVariants;

          return (
            <div
              key={component._id}
              className="border border-gray-200 dark:border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                {component.mainImage && (
                  <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      fill
                      alt={component.name}
                      className="object-cover"
                      src={productImageUrl(component.mainImage, 128, component.imageDisplay)}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">
                    {component.quantity > 1 && `${component.quantity}× `}
                    <Link
                      className="hover:underline"
                      href={`/store/products/${component.slug}`}
                    >
                      {component.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ${component.price.toFixed(2)} value
                  </p>

                  {needsPicker ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {component.variants.map((variant) => {
                        const isSelected = selected === variant.sku;
                        const outOfStock = variant.stock < component.quantity;

                        return (
                          <button
                            key={variant.sku}
                            disabled={outOfStock}
                            className={`px-3 py-2 border rounded-md text-sm transition-colors ${
                              isSelected
                                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                : outOfStock
                                  ? "border-gray-200 dark:border-gray-800 text-gray-400 line-through cursor-not-allowed"
                                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                            onClick={() => handleSelect(component._id, variant.sku)}
                          >
                            {formatVariantLabel(component, variant)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {component.variants[0]
                        ? `${component.variants[0].stock} in stock`
                        : "Unavailable"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Availability + quantity + add */}
      <div className="space-y-4">
        {allSelected && maxAvailable > 0 && maxAvailable < 5 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Only {maxAvailable} of this combination left
          </p>
        )}

        {allSelected && maxAvailable === 0 && (
          <p className="text-sm text-red-600 dark:text-red-400">
            This combination is out of stock — try different options.
          </p>
        )}

        {!allSelected && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pick an option for each item to continue.
          </p>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md">
            <button
              aria-label="Decrease quantity"
              className="px-3 py-2 disabled:opacity-40"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
            <button
              aria-label="Increase quantity"
              className="px-3 py-2 disabled:opacity-40"
              disabled={quantity >= effectiveMax}
              onClick={() => setQuantity((q) => Math.min(effectiveMax, q + 1))}
            >
              +
            </button>
          </div>

          <button
            className="flex-1 px-6 py-3 rounded-md font-medium bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            disabled={!canAdd}
            onClick={handleAddToCart}
          >
            {canAdd ? "Add bundle to cart" : "Unavailable"}
          </button>
        </div>

        {added && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 dark:text-green-400">
              Added to cart
            </span>
            <Link className="underline" href="/cart">
              View cart
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
