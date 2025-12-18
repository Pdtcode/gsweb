"use client";

import { useState } from "react";
import { ProductVariant } from "@/types";

interface VariantSelectorProps {
  variants: ProductVariant[];
  onVariantChange: (selectedOptions: { [key: string]: string }) => void;
}

export function VariantSelector({ variants, onVariantChange }: VariantSelectorProps) {
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: string }>({});

  const handleOptionClick = (variantName: string, option: string) => {
    const newSelectedOptions = {
      ...selectedOptions,
      [variantName]: option,
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
              const isSelected = selectedOptions[variant.name] === option;
              return (
                <button
                  key={optIndex}
                  className={`px-4 py-2 border rounded-md transition-colors ${
                    isSelected
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
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
