"use client";

import { useState } from "react";
import { AvailableVariant, ProductVariant } from "@/types";

interface VariantSelectorProps {
  variants: ProductVariant[];
  // Live stock. Without it, nothing gets marked as sold out.
  availableVariants?: AvailableVariant[];
  onVariantChange: (selectedOptions: { [key: string]: string }) => void;
}

const same = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

// Whether this option is out of stock, given what's already chosen for the other
// options. An option that doesn't match any stock record stays available, so a
// naming mismatch can never hide something that's for sale.
function isSoldOut(
  variantName: string,
  option: string,
  selectedOptions: { [key: string]: string },
  stock?: AvailableVariant[],
) {
  if (!stock?.length) return false;

  const matchesOption = (name: string, value: string, record: AvailableVariant) => {
    const key = name.toLowerCase();

    if (key === "size") return same(record.size, value);
    if (key === "color") return same(record.color, value);

    return false;
  };

  const records = stock.filter((record) => matchesOption(variantName, option, record));

  if (!records.length) return false;

  const others = Object.entries(selectedOptions).filter(([name]) => name !== variantName);

  return !records.some(
    (record) =>
      record.stock > 0 &&
      others.every(([name, value]) => matchesOption(name, value, record)),
  );
}

export function VariantSelector({
  variants,
  availableVariants,
  onVariantChange,
}: VariantSelectorProps) {
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: string }>({});

  const handleOptionClick = (variantName: string, option: string) => {
    // Clean the option by removing stock count like "(12 left)"
    const cleanedOption = option.replace(/\s*\(\d+\s+left\)$/i, '').trim();

    const newSelectedOptions = {
      ...selectedOptions,
      [variantName]: cleanedOption,
    };
    setSelectedOptions(newSelectedOptions);
    onVariantChange(newSelectedOptions);
  };

  if (!variants || variants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {variants.map((variant, index) => (
        <div key={index} className="space-y-2">
          <h3 className="font-medium">
            {variant.name}
            {selectedOptions[variant.name] && (
              <span className="ml-2 text-sm text-gray-500">
                ({selectedOptions[variant.name]})
              </span>
            )}
          </h3>
          <div className="flex flex-wrap gap-2">
            {variant.options.map((option, optIndex) => {
              // Clean option for comparison
              const cleanedOption = option.replace(/\s*\(\d+\s+left\)$/i, '').trim();
              const isSelected = selectedOptions[variant.name] === cleanedOption;
              const soldOut = isSoldOut(
                variant.name,
                cleanedOption,
                selectedOptions,
                availableVariants,
              );

              return (
                <button
                  key={optIndex}
                  aria-label={soldOut ? `${cleanedOption}, sold out` : undefined}
                  className={`px-4 py-2 border rounded-md transition-colors ${
                    soldOut
                      ? "cursor-not-allowed border-gray-200 text-gray-400 line-through dark:border-gray-800 dark:text-gray-600"
                      : isSelected
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  disabled={soldOut}
                  type="button"
                  onClick={() => handleOptionClick(variant.name, option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
